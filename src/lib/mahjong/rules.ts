/**
 * 麻雀のルール判定・局進行モジュール
 * 連荘・輪荘判定、ノーテン罰符配分、チョンボ処理、ダブロン供託分配、
 * 飛び判定、西入サドンデス、アガリやめ・テンパイやめ判定
 * （React/Supabase完全非依存の純粋関数）
 */

import {
  GameStateSnapshot,
  RoundRecord,
  RuleConfig,
} from '@/types/mahjong';
import { roundUp100, calcPoint } from './calc';

/**
 * 局インデックスから現在の親プレイヤーを取得
 * @param players プレイヤー名の配列（起家から順に座順4名）
 * @param roundIdx 局インデックス（0: 東1局, 1: 東2局 ...）
 */
export function getDealer(players: string[], roundIdx: number): string {
  if (!players || players.length === 0) return '';
  return players[roundIdx % players.length];
}

/**
 * 局インデックスから局名文字列を生成
 * @param roundIdx 局インデックス（0〜）
 * @returns 局名（例: "東1局", "南4局", "西1局"）
 */
export function getRoundName(roundIdx: number): string {
  const winds = ['東', '南', '西'];
  const windIndex = Math.min(Math.floor(roundIdx / 4), 2);
  const wind = winds[windIndex];
  const kyokuNumber = (roundIdx % 4) + 1;
  return `${wind}${kyokuNumber}局`;
}

/**
 * 放銃者から見てツモ巡が最も近い和了者（上家取り）を取得する純粋関数
 * @param players 座順プレイヤー配列（東・南・西・北）
 * @param loser 放銃者名
 * @param winners 和了者名配列
 */
export function getClosestWinner(players: string[], loser: string, winners: string[]): string {
  if (!loser || winners.length === 0) return winners[0] || '';
  const loserIdx = players.indexOf(loser);
  if (loserIdx === -1) return winners[0] || '';

  const distance = (p: string) => {
    const idx = players.indexOf(p);
    return (idx - loserIdx + players.length) % players.length;
  };

  return [...winners].sort((a, b) => distance(a) - distance(b))[0];
}

/**
 * 局履歴から現在の対局状態（スコア、本場、供託、局数）を完全に再計算する純粋関数
 *
 * @param players プレイヤー配列（東・南・西・北）
 * @param initScore 配給原点（通常25000点）
 * @param ruleConfig ルール設定
 * @param roundHistory これまでに確定した局結果の配列
 * @param currentRiichiDeclared 現在進行中の局でリーチをかけているプレイヤー配列
 * @returns GameStateSnapshot 再計算された対局状態
 */
export function recalculateState(
  players: string[],
  initScore: number,
  ruleConfig: RuleConfig,
  roundHistory: RoundRecord[],
  currentRiichiDeclared: string[] = []
): GameStateSnapshot {
  const scores: Record<string, number> = {};
  for (const p of players) {
    scores[p] = initScore;
  }

  let riichiStick = 0;
  let honba = 0;
  let roundIdx = 0;

  const detailCfg = ruleConfig.detail || {};
  const honbaPt = detailCfg.honba_pt ?? 300;
  const riichiPt = detailCfg.riichi_pt ?? 1000;

  for (const r of roundHistory) {
    const dealer = players[roundIdx % 4];
    r.kyoku_name = getRoundName(roundIdx);
    r.starting_riichi_sticks = riichiStick;
    r.honba = honba;

    // 当該局のリーチ宣言棒の供託処理
    const roundRiichi = r.riichi || [];
    for (const p of roundRiichi) {
      if (p in scores) {
        scores[p] -= riichiPt;
        riichiStick += 1;
      }
    }

    let dealerContinues = false;
    const winType = r.win_type;
    const winner = r.winner || '';
    const loser = r.loser || '';
    const score = r.score || 0;

    switch (winType) {
      case 'ron': {
        const total = score + honba * honbaPt;
        if (loser in scores) {
          scores[loser] -= total;
        }
        if (winner in scores) {
          scores[winner] += total + riichiStick * riichiPt;
        }
        riichiStick = 0;
        if (winner === dealer) {
          dealerContinues = true;
        }
        break;
      }

      case 'tsumo': {
        const honbaEach = honba * Math.floor(honbaPt / 3);
        if (winner === dealer) {
          // 親ツモ: 子3名が均等に支払い
          const each = Math.floor(score / 3) + honbaEach;
          for (const p of players) {
            if (p !== winner) {
              scores[p] -= each;
              scores[winner] += each;
            }
          }
          scores[winner] += riichiStick * riichiPt;
          dealerContinues = true;
        } else {
          // 子ツモ: 親と子で支払い比率が異なる
          const baseKoPay = roundUp100(score / 4);
          const baseOyaPay = score - baseKoPay * 2;
          const oyaPay = baseOyaPay + honbaEach;
          const koPay = baseKoPay + honbaEach;

          for (const p of players) {
            if (p === winner) continue;
            const pay = p === dealer ? oyaPay : koPay;
            scores[p] -= pay;
            scores[winner] += pay;
          }
          scores[winner] += riichiStick * riichiPt;
        }
        riichiStick = 0;
        break;
      }

      case 'ryukyoku': {
        const tenpai = r.tenpai || [];
        const noten = players.filter((p) => !tenpai.includes(p));
        const nT = tenpai.length;
        const nN = noten.length;

        // テンパイ料の移動（全員テンパイまたは全員ノーテン時は移動なし）
        if (nT > 0 && nT < 4) {
          const bappu = detailCfg.noten_bappu_pt ?? 3000;
          const eachNoten = Math.floor(bappu / nN);
          const eachTenpai = Math.floor(bappu / nT);
          for (const p of noten) {
            scores[p] -= eachNoten;
          }
          for (const p of tenpai) {
            scores[p] += eachTenpai;
          }
        }

        const renchanRule = detailCfg.renchan_rule ?? 'tenpai';
        if (renchanRule === 'tenpai') {
          dealerContinues = tenpai.includes(dealer);
        } else if (renchanRule === 'agari') {
          dealerContinues = false;
        } else if (renchanRule === 'noten') {
          dealerContinues = true;
        }
        break;
      }

      case 'chombo': {
        const chomboPlayer = winner;
        const chomboRule = detailCfg.chombo_rule ?? 'mangan_pay';
        if (chomboRule === 'mangan_pay') {
          const mBase = detailCfg.mangan_base_pt ?? 8000;
          const oyaPay = Math.floor(mBase / 2);
          const koPay = Math.floor(mBase / 4);

          if (chomboPlayer === dealer) {
            // 親のチョンボ: 子全員に 4000点ずつ支払い
            for (const p of players) {
              if (p !== chomboPlayer) {
                scores[chomboPlayer] -= oyaPay;
                scores[p] += oyaPay;
              }
            }
          } else {
            // 子のチョンボ: 親に 4000点、他2名の子に 2000点ずつ支払い
            for (const p of players) {
              if (p === chomboPlayer) continue;
              const pay = p === dealer ? oyaPay : koPay;
              scores[chomboPlayer] -= pay;
              scores[p] += pay;
            }
          }
        }
        dealerContinues = true;
        break;
      }

      case 'multi_ron': {
        const winsData = r.multi_wins || [];
        const winNames = winsData.map((w) => w.winner);
        const closestWinner = getClosestWinner(players, loser, winNames);

        let isDealerWon = false;

        for (const wd of winsData) {
          const w = wd.winner;
          const pts = (wd.points_data?.total ?? 0) + honba * honbaPt;
          if (loser in scores) {
            scores[loser] -= pts;
          }
          if (w in scores) {
            scores[w] += pts;
          }
          if (w === dealer) {
            isDealerWon = true;
          }
        }

        // 供託リーチ棒は上家取り（最も近い和了者）が総取り
        if (closestWinner && closestWinner in scores) {
          scores[closestWinner] += riichiStick * riichiPt;
        }
        riichiStick = 0;

        if (isDealerWon) {
          dealerContinues = true;
        }
        break;
      }

      case 'mid_ryukyoku': {
        const ryukyokuType = r.ryukyoku_type || 'other';
        dealerContinues = true;
        if (
          ryukyokuType !== 'other' &&
          (detailCfg as Record<string, unknown>)[ryukyokuType] === 'ryukyoku'
        ) {
          dealerContinues = false;
        }
        break;
      }
    }

    // 連荘・輪荘および本場数の更新
    if (winType === 'chombo') {
      // チョンボ時は本場・局数を据え置き（ノーカウント）
    } else if (winType === 'ryukyoku' || winType === 'mid_ryukyoku') {
      honba += 1;
      if (!dealerContinues) {
        roundIdx += 1;
      }
    } else {
      if (dealerContinues) {
        honba += 1;
      } else {
        roundIdx += 1;
        honba = 0;
      }
    }
  }

  // 現在進行中の局のリーチ宣言を反映
  for (const p of currentRiichiDeclared) {
    if (p in scores) {
      scores[p] -= riichiPt;
      riichiStick += 1;
    }
  }

  return {
    players: [...players],
    scores: { ...scores },
    roundIdx,
    honba,
    riichiStick,
    roundHistory: [...roundHistory],
    riichiDeclared: [...currentRiichiDeclared],
    furoDeclared: [],
  };
}

/**
 * 対局の終了条件を判定する純粋関数
 *
 * @param scores 現在のプレイヤー持ち点
 * @param roundIdx 現在の局インデックス（0: 東1局, 3: 東4局, 7: 南4局, 8: 西1局 ...）
 * @param players プレイヤー配列
 * @param ruleConfig ルール設定
 * @param roundHistory 直前までの局履歴
 * @returns 終了理由文字列（対局続行時は null）
 */
export function checkGameEnd(
  scores: Record<string, number>,
  roundIdx: number,
  players: string[],
  ruleConfig: RuleConfig,
  roundHistory: RoundRecord[] = []
): string | null {
  const basic = ruleConfig.basic || ruleConfig;
  const detail = ruleConfig.detail || {};

  // 1. 飛び終了判定
  const tobiEnd = detail.tobi_end ?? 'under_zero';
  if (tobiEnd === 'under_zero') {
    for (const [p, s] of Object.entries(scores)) {
      if (s < 0) {
        return `飛び終了（${p} が0点未満）`;
      }
    }
  } else if (tobiEnd === 'zero_or_less') {
    for (const [p, s] of Object.entries(scores)) {
      if (s <= 0) {
        return `飛び終了（${p} が0点以下）`;
      }
    }
  }

  const scoreValues = Object.values(scores);
  const topScore = Math.max(...scoreValues);
  const topPlayers = Object.entries(scores)
    .filter(([, s]) => s === topScore)
    .map(([p]) => p);

  const gameLength = basic.game_length ?? 'hanchan';
  const retScore = basic.return_score ?? 30000;
  const westExt = detail.west_extension ?? 'under_30000';

  // 最終局の基準インデックス（東風戦: 3 (東4局), 半荘戦: 7 (南4局)）
  const finalIdx = gameLength === 'tonpu' ? 3 : 7;
  const nextWindName = gameLength === 'tonpu' ? '南' : '西';
  const finalWindName = gameLength === 'tonpu' ? '東' : '南';

  // 2. アガリやめ・テンパイやめ判定
  if (roundIdx >= finalIdx) {
    const dealer = players[roundIdx % players.length];
    if (topScore >= retScore || westExt === 'none' || westExt === 'fixed_nan4') {
      if (topPlayers.includes(dealer)) {
        if (roundHistory.length > 0) {
          const lastRound = roundHistory[roundHistory.length - 1];
          if (lastRound.kyoku_name === getRoundName(roundIdx)) {
            if (detail.agari_yame ?? true) {
              const winT = lastRound.win_type;
              if (
                (winT === 'ron' || winT === 'tsumo') &&
                lastRound.winner === dealer
              ) {
                return 'アガリやめ（親トップ）';
              } else if (
                winT === 'multi_ron' &&
                (lastRound.multi_wins || []).some((wd) => wd.winner === dealer)
              ) {
                return 'アガリやめ（親トップ）';
              }
            }
            if (detail.tenpai_yame ?? true) {
              if (
                lastRound.win_type === 'ryukyoku' &&
                (lastRound.tenpai || []).includes(dealer)
              ) {
                return 'テンパイやめ（親トップ）';
              }
            }
          }
        }
      }
    }
  }

  const limitIdx = finalIdx + 1;

  // 3. 延長なしの場合の終了判定
  if (westExt === 'none' || westExt === 'fixed_nan4') {
    if (roundIdx >= limitIdx) {
      return `${finalWindName}4局終了`;
    }
  } else {
    // 4. 西入 / サドンデス判定
    if (topScore >= retScore) {
      // 南4局終了時点でトップが返り点以上なら終了
      const hasNextWindRound = roundHistory.some((r) =>
        r.kyoku_name.startsWith(nextWindName)
      );
      if (roundIdx === limitIdx && !hasNextWindRound) {
        return `${finalWindName}4局終了（トップ ${topScore.toLocaleString()}点）`;
      } else if (roundIdx >= limitIdx) {
        return `サドンデス終了（トップ ${topScore.toLocaleString()}点）`;
      }
    } else if (roundIdx >= limitIdx + 4) {
      // 延長しても決着がつかなかった場合（西4局終了）
      return `${nextWindName}4局終了（延長終了）`;
    }
  }

  return null;
}

export interface SettlementPlayerResult {
  player: string;
  seat: number; // 1:東, 2:南, 3:西, 4:北
  finalScore: number; // 供託加算後の最終素点
  rawScore: number; // 供託加算前の素点
  rank: number; // 1〜4
  point: number; // ウマオカ計算後の確定pt (例: 58.0)
}

/**
 * 終局時の精算計算を行う純粋関数
 * 1. 供託リーチ棒のトップ加算
 * 2. 素点降順・同点起家優先による順位決定 (1〜4位)
 * 3. calcPoint によるウマオカポイント算出
 * 4. 合計0.0ptにするための端数（0.1pt）ゼロサム調整（トップで吸収）
 */
export function calculateGameSettlement(
  players: string[],
  scores: Record<string, number>,
  ruleConfig: RuleConfig = {},
  remainingRiichiSticks: number = 0
): SettlementPlayerResult[] {
  const riichiPt = ruleConfig.detail?.riichi_pt ?? 1000;
  const stickBonus = remainingRiichiSticks * riichiPt;

  // 1. 各プレイヤーの生スコアを整理
  const rawList = players.map((p, idx) => ({
    player: p,
    seat: idx + 1,
    rawScore: scores[p] ?? 25000,
    finalScore: scores[p] ?? 25000,
  }));

  // 2. 暫定順位決定（素点降順、同点は起家・座順優先）
  rawList.sort((a, b) => {
    if (b.rawScore !== a.rawScore) {
      return b.rawScore - a.rawScore;
    }
    return a.seat - b.seat;
  });

  // 3. トップ（1位）に供託リーチ棒を加算
  if (stickBonus > 0 && rawList.length > 0) {
    rawList[0].finalScore += stickBonus;
  }

  // 供託加算後に再ソート
  rawList.sort((a, b) => {
    if (b.finalScore !== a.finalScore) {
      return b.finalScore - a.finalScore;
    }
    return a.seat - b.seat;
  });

  // 4. ポイント計算
  const results: SettlementPlayerResult[] = rawList.map((item, idx) => {
    const rank = idx + 1;
    const pt = calcPoint(item.finalScore, rank, ruleConfig);
    return {
      ...item,
      rank,
      point: pt,
    };
  });

  // 5. ゼロ和検算（端数調整）
  const totalPt = results.reduce((sum, r) => sum + r.point, 0);
  const roundedDiff = Math.round(totalPt * 10) / 10;
  if (Math.abs(roundedDiff) > 0.0001 && results.length > 0) {
    results[0].point = Math.round((results[0].point - roundedDiff) * 10) / 10;
  }

  return results;
}
