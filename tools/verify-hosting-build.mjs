import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = path.join(root, 'web/dist')
const sha = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const index = fs.readFileSync(path.join(dist, 'index.html'))
const html = index.toString('utf8')
const script = html.match(/<script\b[^>]*\bsrc="([^"]+\.js)"/)?.[1]
assert(script?.startsWith('/assets/'), 'Expected a generated /assets/ JavaScript entry')
assert(html.includes(`name="dugo-build" content="${sha}"`), 'HTML stamp must match checked-out HEAD; rebuild first')
const bundle = fs.readFileSync(path.join(dist, script))
const assets = fs.readdirSync(path.join(dist, 'assets')).filter(name => /\.(?:js|css)$/.test(name)).sort()
  .map(name => ({ path: `/assets/${name}`, bytes: fs.readFileSync(path.join(dist, 'assets', name)) }))
assert(assets.some(asset => asset.path.endsWith('.js') && asset.bytes.includes(Buffer.from(`production:${sha}`))),
  'A compiled JavaScript chunk must contain production:<source SHA>')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const report = { buildSha: sha, script, scriptSha256: hash(bundle), compiledAssets: assets.length, localBuild: 'verified' }

if (process.argv[2]) {
  const origin = new URL(process.argv[2]).origin
  const checks = []
  const targets = [
    ['/', index, 'no-cache'],
    ['/register', index, 'no-cache'],
    ...assets.map(asset => [asset.path, asset.bytes, 'public, max-age=31536000, immutable']),
  ]
  const verify = async ([urlPath, expected, policy]) => {
    const response = await fetch(new URL(urlPath, origin), { headers: { 'Cache-Control': 'no-cache' } })
    assert.equal(response.status, 200, `${urlPath}: HTTP status`)
    assert.equal(response.headers.get('cache-control'), policy, `${urlPath}: cache policy`)
    const remote = Buffer.from(await response.arrayBuffer())
    assert.equal(hash(remote), hash(expected), `${urlPath}: deployed bytes must match the local build`)
    return { path: urlPath, cacheControl: policy, sha256: hash(remote) }
  }
  for (let offset = 0; offset < targets.length; offset += 6) {
    checks.push(...await Promise.all(targets.slice(offset, offset + 6).map(verify)))
  }
  report.origin = origin
  report.deployedBuild = 'verified'
  report.checks = checks
}
console.log(JSON.stringify(report, null, 2))
