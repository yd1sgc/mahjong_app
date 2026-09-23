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

async function fetchAllRows(tableName) {
  const pageSize = 1000;
  let offset = 0;
  let allRows = [];
  while (true) {
    const url = `${supabaseUrl}/rest/v1/${tableName}?select=*&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    const data = await res.json();
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return allRows;
}

async function run() {
  console.log('=== 旧アプリ流局172席の base_point -> penalty_point 修復処理開始 ===');

  const [rounds, seats, games] = await Promise.all([
    fetchAllRows('rounds'),
    fetchAllRows('round_seats'),
    fetchAllRows('games'),
  ]);

  const oldGames = games.filter((g) => new Date(g.created_at) <= new Date('2026-09-10'));
  const oldGameIds = new Set(oldGames.map((g) => g.game_id));

  const ryukyokuRounds = rounds.filter((r) => r.result_type === 'ryukyoku' && oldGameIds.has(r.game_id));
  const ryukyokuRoundIds = new Set(ryukyokuRounds.map((r) => r.round_id));

  const targetSeats = seats.filter((s) => ryukyokuRoundIds.has(s.round_id) && s.base_point !== 0);
  console.log(`修復対象レコード数: ${targetSeats.length} 件`);

  let successCount = 0;
  let errorCount = 0;

  for (const s of targetSeats) {
    const url = `${supabaseUrl}/rest/v1/round_seats?round_id=eq.${s.round_id}&seat=eq.${s.seat}`;
    const newPenalty = (s.penalty_point || 0) + s.base_point;
    const body = {
      base_point: 0,
      penalty_point: newPenalty,
    };

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      successCount++;
    } else {
      errorCount++;
      const txt = await res.text();
      console.error(`エラー [round_id=${s.round_id}, seat=${s.seat}]: ${txt}`);
    }
  }

  console.log(`修復完了: 成功 ${successCount} 件, 失敗 ${errorCount} 件`);
}

run().catch((e) => console.error(e));
