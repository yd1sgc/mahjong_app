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
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    env[k] = v;
  }
}

const url = env['NEXT_PUBLIC_SUPABASE_URL'];
const key = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

async function main() {
  const res = await fetch(`${url}/rest/v1/games?status=eq.in_progress&select=game_id,played_at,rule_name_snapshot,status`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });

  const games = await res.json();
  console.log('--- 進行中 (status = in_progress) の対局一覧 ---');
  console.log(`件数: ${games.length} 件`);

  for (const g of games) {
    const rRes = await fetch(`${url}/rest/v1/rounds?game_id=eq.${g.game_id}&select=round_id,round_index,kyoku_name`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    const rounds = await rRes.json();
    console.log(`- 対局ID: ${g.game_id}`);
    console.log(`  日時: ${g.played_at}`);
    console.log(`  ルール: ${g.rule_name_snapshot}`);
    console.log(`  記録された局数: ${rounds.length} 局`);
    if (rounds.length > 0) {
      console.log(`  最終局: ${rounds[rounds.length - 1].kyoku_name}`);
    }
  }
}

main().catch((err) => {
  console.error('実行エラー:', err);
  process.exit(1);
});
