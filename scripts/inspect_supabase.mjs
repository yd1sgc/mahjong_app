import fs from 'fs';
import path from 'path';

// .env.local の手動読み込み
const envPath = path.resolve(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('.env.local が見つかりません。');
  process.exit(1);
}

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

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

console.log('Target Supabase URL:', supabaseUrl);
console.log('Target Anon Key Prefix:', supabaseKey ? supabaseKey.slice(0, 15) + '...' : 'NONE');

if (!supabaseUrl || !supabaseKey) {
  console.error('URLまたはKeyが設定されていません。');
  process.exit(1);
}

const tables = [
  'members',
  'groups',
  'group_memberships',
  'rule_templates',
  'games',
  'game_participants',
  'rounds',
  'round_seats'
];

async function inspect() {
  console.log('\n--- Supabase テーブル現況調査 (Read-Only) ---');
  for (const table of tables) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
        method: 'HEAD',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'count=exact'
        }
      });

      if (res.ok) {
        const contentRange = res.headers.get('content-range');
        const count = contentRange ? contentRange.split('/')[1] : 'unknown';
        console.log(`[OK] テーブル '${table}': ${count} 件`);
      } else {
        const text = await res.text();
        console.log(`[ERR] テーブル '${table}': HTTP ${res.status} - ${text || res.statusText}`);
      }
    } catch (e) {
      console.log(`[ERR] テーブル '${table}': 通信例外 - ${e.message}`);
    }
  }

  // 直近の games のサンプルを1件取得してみる
  try {
    const sampleRes = await fetch(`${supabaseUrl}/rest/v1/games?select=game_id,played_at,status,rule_name_snapshot&limit=3&order=played_at.desc`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    if (sampleRes.ok) {
      const data = await sampleRes.json();
      console.log('\n--- 登録済み games サンプル (最新3件) ---');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.log('games サンプル取得失敗:', e.message);
  }
}

inspect();
