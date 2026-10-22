#!/usr/bin/env node
//
// Validate the requirement traceability table, and cross-check the schema
// documents against the security rules.
//
// `docs/REQUIREMENTS.md` is the source of truth for what is built, and the
// handoff documents refer to it by ID rather than copying its state. That only
// works while the table is internally consistent, so this checks:
//
//   - every row has a Feature that resolves to the roster in docs/PHASES.md
//   - every roster entry is used by at least one row (no orphans either way)
//   - every `D*` referenced in a Notes cell exists in the Decisions table
//   - every row with Status done/partial has a Notes entry
//   - the tables are rectangular (same cell count per row in a section)
//
// And the doc-integrity cross-checks, so a write-up cannot silently rot:
//
//   - every `D*` referenced anywhere in docs/ resolves to a Decisions row
//   - docs/SCHEMA_CHANGELOG.md entries reference real `D*` rows
//   - every collection in the schema's §1 tree has a `match` in firestore.rules
//     and vice versa
//   - field names the rules validate on `users` appear in schema §2.1
//   - a change to firestore.rules / indexes / services without a docs change
//     in the same commit warns (does not fail — it cannot judge relevance)
//
// Run: `node tools/check-docs.mjs`. Exits non-zero on the first class of
// failure that is found, listing every offending row.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const reqPath = join(root, 'docs', 'REQUIREMENTS.md');
const phasesPath = join(root, 'docs', 'PHASES.md');
const schemaPath = join(root, 'docs', 'firestore_schema.md');
const changelogPath = join(root, 'docs', 'SCHEMA_CHANGELOG.md');
const rulesPath = join(root, 'firestore.rules');

const reqText = readFileSync(reqPath, 'utf8');
const phasesText = readFileSync(phasesPath, 'utf8');

const errors = [];
const reqLines = reqText.split('\n');

// A requirement row: | FR-01 | ... |. NFR rows carry an extra Category cell,
// so their column positions are shifted by one.
const rowRe = /^\|\s*((?:FR|NFR)-\d+[a-z]?)\s*\|/;

const rows = [];
for (const line of reqLines) {
  const m = rowRe.exec(line);
  if (!m) continue;
  const cells = line.split('|').slice(1, -1).map((c) => c.trim());
  const id = m[1];
  const isFR = id.startsWith('FR');
  rows.push({
    id,
    isFR,
    cells,
    status: isFR ? cells[4] : cells[5],
    notes: isFR ? cells[5] : cells[6],
    feature: isFR ? cells[6] : cells[7],
    evidence: cells[cells.length - 1],
  });
}

if (rows.length === 0) {
  errors.push('no requirement rows found; has the table moved or changed shape?');
}

// --- Decisions table -------------------------------------------------------
const decisions = new Set();
for (const line of reqLines) {
  const m = /^\|\s*(D\d+)\s*\|/.exec(line);
  if (m) decisions.add(m[1]);
}

// --- Feature roster in docs/PHASES.md --------------------------------------
const roster = new Set();
{
  const start = phasesText.indexOf('## 4. The feature list');
  const end = phasesText.indexOf('### Worked examples');
  const block = start !== -1 && end !== -1 ? phasesText.slice(start, end) : '';
  for (const line of block.split('\n')) {
    const m = /^\|\s*(F\d+)\s*\|/.exec(line);
    if (m) roster.add(m[1]);
  }
}

// --- Per-row checks --------------------------------------------------------
const usedFeatures = new Set();
const idRe = /\bF\d+\b/g;

for (const row of rows) {
  const feat = row.feature;
  const isDash = feat === '—' || feat === '-' || feat === '';
  if (isDash) {
    errors.push(`${row.id}: no Feature (expected an F-id from the roster)`);
  } else {
    const ids = feat.match(idRe) || [];
    if (ids.length === 0) {
      errors.push(`${row.id}: Feature "${feat}" contains no F-id`);
    }
    for (const f of ids) {
      usedFeatures.add(f);
      if (!roster.has(f)) {
        errors.push(`${row.id}: Feature ${f} is not in the roster (docs/PHASES.md §4)`);
      }
    }
  }

  // Notes required once a row is done or partial.
  const notes = row.notes;
  const notesEmpty = notes === '—' || notes === '-' || notes === '';
  if ((row.status === 'done' || row.status === 'partial') && notesEmpty) {
    errors.push(`${row.id}: Status is "${row.status}" but Notes is empty`);
  }

  // D-refs in Notes must resolve.
  for (const d of notes.match(/\bD\d+\b/g) || []) {
    if (!decisions.has(d)) {
      errors.push(`${row.id}: Notes references ${d}, which is not in the Decisions table`);
    }
  }

  // Evidence must exist for done/partial rows.
  if ((row.status === 'done' || row.status === 'partial') && row.evidence === '') {
    errors.push(`${row.id}: Status is "${row.status}" but Where/evidence is empty`);
  }
}

// --- Roster orphan check ---------------------------------------------------
for (const f of roster) {
  if (!usedFeatures.has(f)) {
    errors.push(`roster entry ${f} is not referenced by any requirement row`);
  }
}

// --- Rectangular tables ----------------------------------------------------
{
  let header = null;
  let expected = null;
  for (const line of reqLines) {
    if (/^\|\s*ID\s*\|/.test(line)) {
      header = line;
      expected = line.split('|').length;
      continue;
    }
    if (/^\|[\s:-]+\|$/.test(line)) continue;
    if (!rowRe.test(line)) continue;
    const n = line.split('|').length;
    if (expected !== null && n !== expected) {
      const id = rowRe.exec(line)[1];
      errors.push(`${id}: row has ${n - 2} cells but its section header has ${expected - 2}`);
    }
  }
}

// --- Doc integrity: `D*` refs resolve everywhere in docs/ ------------------
// Notes-only checking let a dangling reference survive in prose, the schema or
// the changelog. Every `D*` written anywhere in docs/ must be a real decision.
{
  const docsDir = join(root, 'docs');
  const files = existsSync(docsDir)
    ? readdirSync(docsDir).filter((f) => f.endsWith('.md'))
    : [];
  for (const file of files) {
    const text = readFileSync(join(docsDir, file), 'utf8');
    for (const d of new Set(text.match(/\bD\d+\b/g) || [])) {
      if (!decisions.has(d)) {
        errors.push(`docs/${file}: references ${d}, which is not in the Decisions table`);
      }
    }
  }
}

// --- Doc integrity: the schema's §1 tree and firestore.rules agree ---------
// Catch collection-level drift mechanically: a collection added to one side and
// not the other is exactly the divergence this repo keeps re-discovering.
function schemaCollections() {
  const text = readFileSync(schemaPath, 'utf8');
  const start = text.indexOf('## 1. Collection tree');
  const fence = text.indexOf('```', start);
  const end = text.indexOf('```', fence + 3);
  const tree = text.slice(fence + 3, end);

  const found = new Set();
  for (const line of tree.split('\n')) {
    // Strip the box-drawing indent, then take the path up to `/{...}` or a space.
    const m = /^\s*(?:[\u2500-\u257F|├└─]+\s*)?([a-zA-Z][a-zA-Z0-9]*)\//.exec(line);
    if (m) found.add(m[1]);
  }
  return found;
}

function rulesCollections() {
  const text = readFileSync(rulesPath, 'utf8');
  const found = new Set();
  for (const line of text.split('\n')) {
    // Every `match /name/...` at any depth — subcollections (`inventory`,
    // `logs`, `guidelines`) are matched nested inside their parent, and the
    // schema's tree lists them the same way. `databases` is the rules wrapper
    // and `{document=**}` the catch-all; neither is a collection.
    const m = /^\s*match\s+\/([a-zA-Z][a-zA-Z0-9]*)\//.exec(line);
    if (m && m[1] !== 'databases') found.add(m[1]);
  }
  return found;
}

{
  const inSchema = schemaCollections();
  const inRules = rulesCollections();
  for (const c of inSchema) {
    if (!inRules.has(c)) {
      errors.push(`schema §1 lists "${c}" but firestore.rules has no top-level match for it`);
    }
  }
  for (const c of inRules) {
    if (!inSchema.has(c)) {
      errors.push(`firestore.rules matches "${c}" but schema §1 does not list it`);
    }
  }
}

// --- Doc integrity: rules field checks appear in schema §2.1 ---------------
// A validator on a field the schema never declares is either a typo or a field
// that was never written down. Both are worth failing on.
{
  const rulesText = readFileSync(rulesPath, 'utf8');
  const usersBlock = rulesText.slice(
    rulesText.indexOf('match /users/'),
    rulesText.indexOf('match /emailVerifications/'),
  );
  const validated = new Set(
    (usersBlock.match(/'([a-zA-Z][a-zA-Z0-9]*)'\s+in\s+request\.resource\.data/g) || []).map(
      (s) => s.match(/'([a-zA-Z][a-zA-Z0-9]*)'/)[1],
    ),
  );

  const schemaText = readFileSync(schemaPath, 'utf8');
  const s21 = schemaText.slice(
    schemaText.indexOf('### 2.1'),
    schemaText.indexOf('### 2.2'),
  );
  // Declared names, including struck-through ones (~~name~~), since a removed
  // field is still worth a deliberate mention.
  const declared = new Set(
    (s21.match(/^\|\s*~{0,2}([a-zA-Z][a-zA-Z0-9]*)/gm) || []).map((s) =>
      s.replace(/^\|\s*~{0,2}/, ''),
    ),
  );

  // The one deliberate exception: `eligibility` is the key the rules refuse, not
  // a stored field, so it is documented in §2.1's prose rather than its table.
  const proseException = /`eligibility`/.test(s21);
  for (const field of validated) {
    if (!declared.has(field) && !(field === 'eligibility' && proseException)) {
      errors.push(
        `firestore.rules validates "${field}" on users but schema §2.1 does not declare it`,
      );
    }
  }
}

// --- Doc integrity: changelog entries have real refs -----------------------
{
  const text = readFileSync(changelogPath, 'utf8');
  const entries = (text.match(/^##\s+\d{4}-\d{2}-\d{2}/gm) || []).length;
  if (entries === 0) {
    errors.push('docs/SCHEMA_CHANGELOG.md has no dated entries');
  }
  for (const d of new Set(text.match(/\*\*Refs:\*\*[^\n]*/g) || [])) {
    for (const ref of d.match(/\bD\d+\b/g) || []) {
      if (!decisions.has(ref)) {
        errors.push(`docs/SCHEMA_CHANGELOG.md: Refs names ${ref}, which is not a decision`);
      }
    }
  }
}

// --- Report ----------------------------------------------------------------
if (errors.length > 0) {
  console.error(`check-docs: ${errors.length} problem(s) in docs/REQUIREMENTS.md\n`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error('');
  process.exit(1);
}

console.log(
  `check-docs: ok (${rows.length} rows, ${roster.size} features, ${decisions.size} decisions)`,
);

// --- Warning: data-layer changed without a docs change ---------------------
// A soft check, on purpose. It cannot judge whether a docs update was needed —
// a comment-only edit to a service is a false positive — so it warns rather
// than failing. CI prints it; a reviewer decides.
{
  const WATCHED = /^(firestore\.rules|firestore\.indexes\.json|web\/src\/services\/)/;
  const DOCS = /^docs\//;
  try {
    const changed = execFileSync(
      'git',
      ['diff', '--name-only', 'origin/integration...HEAD'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
      .split('\n')
      .filter(Boolean);

    const touchedData = changed.some((f) => WATCHED.test(f));
    const touchedDocs = changed.some((f) => DOCS.test(f));
    if (touchedData && !touchedDocs) {
      console.warn(
        'check-docs: warning — this branch changes firestore.rules, indexes or ' +
          'a service with no docs/ change.\n' +
          '  If the data model moved, update docs/firestore_schema.md and add a ' +
          'docs/SCHEMA_CHANGELOG.md entry (D23).\n',
      );
    }
  } catch {
    // No git, no origin/integration, or a detached comparison: skip silently.
    // The warning is a convenience, never a gate.
  }
}

// --- Warning: a retired field name survives in the traceability table ------
// Also soft, for the same reason: it is a blocklist, so it catches the names
// someone remembered to add and nothing more. Scoped to docs/REQUIREMENTS.md —
// the changelog's whole job is to name old shapes, and a decision row that
// records a retirement has to be able to say what was retired. Those rows are
// exempt, so the write-up the rule asks for is never the thing it blocks.
{
  // Each entry: a pattern for the retired spelling, and what replaced it (for
  // the message). Order matters only for the dedupe below.
  const RETIRED = [
    [/contact\.phone/, 'contact.phone', 'phoneNumber'],
    [/location\{GeoPoint/, 'location{GeoPoint', 'flat latitude/longitude'],
    [/location\{/, 'location{', 'flat latitude/longitude/geohash/city'],
  ];
  // Decision rows carry the history on purpose: D4 states what locations are
  // stored as, D16/D22 state what the old shape was. Naming a retired field in
  // one of those is the record, not the rot.
  const EXEMPT_DECISIONS = /^\|\s*(D4|D16|D22)\s*\|/;

  const stale = [];
  for (let i = 0; i < reqLines.length; i++) {
    const line = reqLines[i];
    if (EXEMPT_DECISIONS.test(line)) continue;
    // Only requirement rows and decisions are scanned; section headings, prose
    // and the file's own explanatory notes are not claims about the shape.
    if (!/^\|\s*(?:FR|NFR)-\d+[a-z]?\s*\|/.test(line) && !/^\|\s*D\d+\s*\|/.test(line)) {
      continue;
    }
    // Longest pattern first, so `location{GeoPoint` reports once, not twice.
    const hit = RETIRED.find(([re]) => re.test(line));
    if (hit) {
      stale.push({ line: i + 1, retired: hit[1], replacement: hit[2] });
    }
  }

  if (stale.length > 0) {
    console.warn(
      'check-docs: warning — docs/REQUIREMENTS.md names a retired field shape:\n' +
        stale
          .map((s) => `  line ${s.line}: "${s.retired}" (now ${s.replacement})`)
          .join('\n') +
        '\n  If this is a decision row recording the retirement, add it to ' +
        'EXEMPT_DECISIONS in tools/check-docs.mjs.\n',
    );
  }
}
