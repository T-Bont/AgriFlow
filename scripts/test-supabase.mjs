/**
 * Tests Supabase access using .env config. Run from project root: node scripts/test-supabase.mjs
 */
import { readFileSync, existsSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv(path = '.env') {
  if (!existsSync(path)) {
    console.error('.env not found. Copy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
    process.exit(1)
  }
  const raw = readFileSync(path, 'utf8')
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

async function main() {
  const env = loadEnv()
  const url = env.VITE_SUPABASE_URL
  const anonKey = env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey || url.includes('your-project') || anonKey.includes('your-anon')) {
    console.error('Set real VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (from Supabase Dashboard → Project Settings → API).')
    process.exit(1)
  }

  const supabase = createClient(url, anonKey)
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    console.error('Supabase request failed:', error.message)
    process.exit(1)
  }
  console.log('Supabase connection OK (session:', data.session ? 'present' : 'none', ')')
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
