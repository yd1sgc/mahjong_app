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
  console.log('--- in_progress 対局の一括 completed 更新処理開始 ---');

  // status = 'in_progress' の対局をすべて 'completed' に更新
  const res = await fetch(`${url}/rest/v1/games?status=eq.in_progress`, {
    method: 'PATCH',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      status: 'completed'
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`更新失敗: HTTP ${res.status} - ${errText}`);
  }

  const updated = await res.json();
  console.log(`成功: ${updated.length} 件の対局ステータスを 'completed' に更新しました。`);

  // 検証: 残りの in_progress 件数を再取得
  const checkRes = await fetch(`${url}/rest/v1/games?status=eq.in_progress&select=game_id`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  const remaining = await checkRes.json();
  console.log(`検証: 残りの in_progress 対局数 = ${remaining.length} 件`);
}

main().catch((err) => {
  console.error('エラー発生:', err);
  process.exit(1);
});
