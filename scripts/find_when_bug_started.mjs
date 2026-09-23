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
  // 全対局を日付古い順に取得
  const gRes = await fetch(`${supabaseUrl}/rest/v1/games?select=game_id,played_at,status,rule_name_snapshot,game_mode&order=played_at.asc`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const games = await gRes.json();
  console.log(`総対局数: ${games.length} 件\n`);

  let firstBugGame = null;
  let bugGameCount = 0;
  let normalGameCount = 0;

  for (let idx = 0; idx < games.length; idx++) {
    const g = games[idx];
    const rRes = await fetch(`${supabaseUrl}/rest/v1/rounds?game_id=eq.${g.game_id}&select=round_id,round_index,kyoku_name,honba,round_seats(score_delta,is_winner,is_riichi)&order=round_index.asc`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    const rounds = await rRes.json();

    let hasBugInThisGame = false;
    let bugRounds = [];

    for (const r of rounds) {
      const seats = r.round_seats || [];
      if (seats.length === 0) continue;
      const sumDelta = seats.reduce((sum, s) => sum + s.score_delta, 0);
      const hasRiichi = seats.some((s) => s.is_riichi === 1);

      // 流局等で供託棒が残った場合はマイナス（卓上残り）になることがあるが、プラスになることは数学的にあり得ない
      // または、和了局で sumDelta != 0 の場合は不整合
      if (hasRiichi && sumDelta > 0) {
        hasBugInThisGame = true;
        bugRounds.push({
          round: `第${r.round_index + 1}局(${r.kyoku_name})`,
          sumDelta,
        });
      }
    }

    if (hasBugInThisGame) {
      bugGameCount++;
      if (!firstBugGame) {
        firstBugGame = {
          index: idx + 1,
          gameId: g.game_id,
          playedAt: g.played_at,
          rule: g.rule_name_snapshot,
          bugRounds,
        };
      }
    } else {
      normalGameCount++;
    }
  }

  console.log('=== 調査結果 ===');
  console.log(`正常な対局: ${normalGameCount} 件`);
  console.log(`不整合が発生している対局: ${bugGameCount} 件\n`);

  if (firstBugGame) {
    console.log(`【最初に不整合が発生した対局】`);
    console.log(`対局番号: 全${games.length}件中 第${firstBugGame.index}番目の対局`);
    console.log(`対局ID: ${firstBugGame.gameId}`);
    console.log(`対局日時: ${firstBugGame.playedAt}`);
    console.log(`ルール: ${firstBugGame.rule}`);
    console.log(`不整合のあった局:`, firstBugGame.bugRounds);
  } else {
    console.log('不整合のある対局は見つかりませんでした。');
  }
}

run().catch(console.error);
