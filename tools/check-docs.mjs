#!/usr/bin/env node
//
// Validate the requirement traceability table.
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
// Run: `node tools/check-docs.mjs`. Exits non-zero on the first class of
// failure that is found, listing every offending row.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const reqPath = join(root, 'docs', 'REQUIREMENTS.md');
const phasesPath = join(root, 'docs', 'PHASES.md');

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
