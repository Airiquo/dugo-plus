import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// The design system lives outside this app (../styles, ../fonts, ../assets) so the
// plain-HTML mockups and the React app share one source of truth.
const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const buildSha = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim()

/** Exposes the deployed source revision in the document head. */
function buildStampPlugin() {
  return {
    name: 'dugo-build-stamp',
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { name: 'dugo-build', content: buildSha }, injectTo: 'head' }]
    },
  }
}
/**
 * Serves the repo root under /mockups so the (refactored) HTML mockups render
 * live inside the dev server — their relative links to ../styles and ../fonts
 * resolve through the same mount. Handy while translating a screen.
 */
function mockupsPlugin() {
  const handler = (req, res, next) => {
    const rel = decodeURIComponent((req.url ?? '').split('?')[0])
    const file = path.normalize(path.join(repoRoot, rel))
    if (!file.startsWith(repoRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      next()
      return
    }
    const type =
      { '.html': 'text/html', '.css': 'text/css', '.png': 'image/png' }[path.extname(file)] ??
      'application/octet-stream'
    res.setHeader('Content-Type', type)
    res.end(fs.readFileSync(file))
  }
  return {
    name: 'dugo-mockups',
    configureServer(server) {
      server.middlewares.use('/mockups', handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/mockups', handler)
    },
  }
}
export default defineConfig({
  plugins: [react(), mockupsPlugin(), buildStampPlugin()],
  define: { 'import.meta.env.VITE_BUILD_SHA': JSON.stringify(buildSha) },
  publicDir: fileURLToPath(new URL('../assets', import.meta.url)),
  server: {
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
