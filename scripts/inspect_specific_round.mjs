import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
}

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

async function run() {
  const gameId = '01a07b99-b031-718e-aa36-10a8eaeb8a99';
  const rRes = await fetch(`${supabaseUrl}/rest/v1/rounds?game_id=eq.${gameId}&round_index=in.(3,7)&select=*,round_seats(*)`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const rounds = await rRes.json();
  console.log(JSON.stringify(rounds, null, 2));
}

run().catch(console.error);
