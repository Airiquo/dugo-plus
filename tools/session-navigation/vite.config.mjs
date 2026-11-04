import { defineConfig } from '../../web/node_modules/vite/dist/node/index.js'
import react from '../../web/node_modules/@vitejs/plugin-react/dist/index.js'
import { fileURLToPath } from 'node:url'
const repo = fileURLToPath(new URL('../../', import.meta.url))
const fixture = fileURLToPath(new URL('./', import.meta.url))
export default defineConfig({
  root: repo + 'web',
  envDir: fixture,
  resolve: { dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'] },
  define: Object.fromEntries(Object.entries({
    API_KEY: 'fixture-key', AUTH_DOMAIN: 'fixture.example.test', PROJECT_ID: 'demo-session-fixture',
    STORAGE_BUCKET: 'fixture.example.test', MESSAGING_SENDER_ID: '123456', APP_ID: '1:123456:web:fixture',
  }).map(([key, value]) => [`import.meta.env.VITE_FIREBASE_${key}`, JSON.stringify(value)])),
  plugins: [{
    name: 'session-fixtures', enforce: 'pre',
    resolveId(source, importer) {
      if (!importer?.startsWith(repo + 'web/src/')) return
      if (/services\/auth(?:\.js)?$/.test(source)) return fixture + 'auth.js'
      if (/services\/users(?:\.js)?$/.test(source)) return fixture + 'users.js'
      for (const service of ['requests', 'dataRequests', 'hospitalResponses', 'inventory', 'hospitalDonations', 'alerts'])
        if (new RegExp('services/' + service + '(?:\\.js)?$').test(source)) return fixture + service + '.js'
      if (/pages\/(?:admin|donor|hospital)\//.test(source) || /pages\/public\/Landing$/.test(source)) return fixture + 'Page.jsx'
    },
  }, react()],
  server: { host: '127.0.0.1', port: 0, fs: { allow: [repo] } },
})
