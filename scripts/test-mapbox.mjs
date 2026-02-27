/**
 * Tests Mapbox token from .env. Run from project root: node scripts/test-mapbox.mjs
 */
import { readFileSync, existsSync, appendFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOG_PATH = join(__dirname, '..', '.cursor', 'debug.log')

function loadEnv(path = '.env') {
  const envPath = join(__dirname, '..', path)
  if (!existsSync(envPath)) {
    console.error('.env not found. Set VITE_MAPBOX_TOKEN in .env to test Mapbox.')
    process.exit(1)
  }
  const raw = readFileSync(envPath, 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1)
    env[key] = value
  }
  return env
}

function writeDebugLog(result) {
  try {
    const line = JSON.stringify({
      id: `mapbox_test_${Date.now()}`,
      timestamp: Date.now(),
      location: 'scripts/test-mapbox.mjs',
      message: 'Mapbox token check',
      data: result,
      runId: 'mapbox-connection-test',
      hypothesisId: 'mapbox-connection',
    }) + '\n'
    appendFileSync(LOG_PATH, line)
  } catch (_) {}
}

async function main() {
  const env = loadEnv()
  const token = env.VITE_MAPBOX_TOKEN

  if (!token || token === 'your-mapbox-token') {
    console.error('Set VITE_MAPBOX_TOKEN in .env (get a token from https://account.mapbox.com/).')
    writeDebugLog({ ok: false, reason: 'missing_or_placeholder_token' })
    process.exit(1)
  }

  // Mapbox styles API requires a valid token
  const url = `https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${token}`
  const res = await fetch(url)

  if (!res.ok) {
    const text = await res.text()
    const result = { ok: false, status: res.status, reason: res.status === 401 ? 'invalid_token' : 'request_failed' }
    writeDebugLog(result)
    console.error('Mapbox request failed:', res.status, res.statusText, text.slice(0, 100))
    process.exit(1)
  }

  const result = { ok: true, status: res.status }
  writeDebugLog(result)
  console.log('Mapbox connection OK (token valid).')
}

main().catch((e) => {
  writeDebugLog({ ok: false, reason: 'error', message: e.message })
  console.error(e.message || e)
  process.exit(1)
})
