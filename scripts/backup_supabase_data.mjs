import fs from 'fs';
import path from 'path';

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
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
}

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

// Supabase REST API から上限を超えて全件取得する関数
async function fetchAll(tableName, select = '*') {
  const pageSize = 1000;
  let offset = 0;
  let allRows = [];

  while (true) {
    const url = `${supabaseUrl}/rest/v1/${tableName}?select=${select}&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch ${tableName}: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (!data || data.length === 0) {
      break;
    }

    allRows = allRows.concat(data);
    if (data.length < pageSize) {
      break;
    }
    offset += pageSize;
  }

  return allRows;
}

async function run() {
  console.log('=== Supabase 全データバックアップ開始 ===');

  const tables = [
    'games',
    'game_participants',
    'rounds',
    'round_seats',
    'yakuman_records',
    'members',
    'groups',
    'rule_templates',
  ];

  const backupData = {
    timestamp: new Date().toISOString(),
    supabaseUrl,
    tables: {},
  };

  for (const table of tables) {
    process.stdout.write(`Fetching ${table}... `);
    const rows = await fetchAll(table);
    backupData.tables[table] = rows;
    console.log(`${rows.length} 件取得完了`);
  }

  const backupDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const backupFilePath = path.join(backupDir, `backup_supabase_${dateStr}.json`);

  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf-8');

  const stats = fs.statSync(backupFilePath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`\n=== バックアップ完了 ===`);
  console.log(`保存先: ${backupFilePath}`);
  console.log(`ファイルサイズ: ${sizeMB} MB`);
}

run().catch((e) => {
  console.error('バックアップエラー:', e);
  process.exit(1);
});
