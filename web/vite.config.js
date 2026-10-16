import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// The design system lives outside this app (../styles, ../fonts, ../assets) so the
// plain-HTML mockups and the React app share one source of truth.
const repoRoot = fileURLToPath(new URL('..', import.meta.url))
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
  plugins: [react(), mockupsPlugin()],
  publicDir: fileURLToPath(new URL('../assets', import.meta.url)),
  server: {
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
