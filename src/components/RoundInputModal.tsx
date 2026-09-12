/**
 * 局結果入力モーダルコンポーネント (統合効率化・3ステップ版)
 * 
 * - Step 0: WinnerAndLoserStep (ロン/ツモ/ダブロン ＆ 和了者・放銃者を1画面で指定)
 * - Step 1: ScoreStep (3x4完全スクロールレスグリッド ＋ 倍満〜/その他)
 * - Step 2: ConfirmStep (最終確認サマリー ＆ 1タップ確定)
 * - 流局: RyukyokuStep (荒廃流局 ＋ 途中流局切替)
 * - チョンボ: ChomboStep
 */

'use client';

import React, { useEffect, useState } from 'react';
import { calculateScore } from '@/lib/mahjong/calc';
import { getDealer, getRoundName, getClosestWinner } from '@/lib/mahjong/rules';
import { RoundRecord, RuleConfig, WinType, MultiWinnerDraft } from '@/types/mahjong';
import { RoundInputDraft } from '@/hooks/useGameDraft';
import { WinnerAndLoserStep } from './round-input/WinnerAndLoserStep';
import { ScoreStep } from './round-input/ScoreStep';
import { ConfirmStep } from './round-input/ConfirmStep';
import { RyukyokuStep, ChomboStep } from './round-input/RyukyokuStep';

interface RoundInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: string[];
  roundIdx: number;
  honba: number;
  riichiSticks: number;
  ruleConfig: RuleConfig;
  draft: RoundInputDraft;
  updateDraft: (updater: Partial<RoundInputDraft> | ((prev: RoundInputDraft) => RoundInputDraft)) => void;
  onCommit: (record: RoundRecord, han?: number, fu?: number) => Promise<boolean>;
  initialWinType: WinType;
}

export const RoundInputModal: React.FC<RoundInputModalProps> = ({
  isOpen,
  onClose,
  players,
  roundIdx,
  honba,
  riichiSticks,
  ruleConfig,
  draft,
  updateDraft,
  onCommit,
  initialWinType,
}) => {
  const [submitting, setSubmitting] = useState(false);
  // 和了フローのステップ: 0: 関係者, 1: 点数, 2: 確認
  const [step, setStep] = useState(0);

  const currentDealer = getDealer(players, roundIdx);
  const roundName = getRoundName(roundIdx);

  // ルール設定に基づく可否（方式A: 無効時は非表示）
  const allowMultiRon = ruleConfig.detail?.allow_multi_ron !== false;
  const allowMidRyukyoku = ruleConfig.detail?.allow_mid_ryukyoku !== false;

  useEffect(() => {
    if (isOpen) {
      updateDraft({
        winType: initialWinType,
        multiWinners: [],
      });
      setStep(0);
    }
  }, [isOpen, initialWinType, updateDraft]);

  if (!isOpen) return null;

  const { winType, winner, loser, han, fu, tenpai, chomboPlayer, multiWinners = [], ryukyokuType = 'kyushu' } = draft;
  const isDealerWinner = winner === currentDealer;

  // 単一和了時の素点計算
  let baseScore = 0;
  if (winType === 'ron' || winType === 'tsumo') {
    const isTsumo = winType === 'tsumo';
    const scoreRes = calculateScore(han || 1, fu || 30, isDealerWinner, isTsumo);
    baseScore = scoreRes.total;
  }

  const honbaPt = (ruleConfig.detail?.honba_pt ?? 300) * honba;
  const riichiPt = (ruleConfig.detail?.riichi_pt ?? 1000) * riichiSticks;
  const totalReceive = baseScore + honbaPt + riichiPt;

  // ダブロン時の上家取り和了者
  const multiWinNames = multiWinners.map((w) => w.winner);
  const closestWinner = getClosestWinner(players, loser || '', multiWinNames);

  // 確定コミット処理
  const handleFinalCommit = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      let record: RoundRecord;

      if (winType === 'ron' || winType === 'tsumo') {
        record = {
          kyoku_name: roundName,
          winner,
          loser: winType === 'ron' ? loser : null,
          win_type: winType,
          score: baseScore,
          riichi: [],
          tenpai: [],
        };
      } else if (winType === 'multi_ron') {
        record = {
          kyoku_name: roundName,
          winner: closestWinner || null,
          loser: loser || null,
          win_type: 'multi_ron',
          score: 0,
          riichi: [],
          multi_wins: multiWinners.map((w) => ({
            winner: w.winner,
            points_data: {
              total: w.score,
              han: w.han,
              fu: w.fu,
            },
          })),
        };
      } else if (winType === 'ryukyoku') {
        record = {
          kyoku_name: roundName,
          winner: null,
          loser: null,
          win_type: 'ryukyoku',
          score: 0,
          riichi: [],
          tenpai,
        };
      } else if (winType === 'mid_ryukyoku') {
        record = {
          kyoku_name: roundName,
          winner: null,
          loser: null,
          win_type: 'mid_ryukyoku',
          score: 0,
          riichi: [],
          ryukyoku_type: ryukyokuType,
        };
      } else {
        // chombo
        record = {
          kyoku_name: roundName,
          winner: chomboPlayer,
          loser: null,
          win_type: 'chombo',
          score: 0,
          riichi: [],
        };
      }

      const ok = await onCommit(record, han, fu);
      if (ok) {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ダブロンの和了者トグル処理
  const handleToggleMultiWinner = (player: string) => {
    const isAlready = multiWinners.some((w) => w.winner === player);
    if (isAlready) {
      updateDraft({
        multiWinners: multiWinners.filter((w) => w.winner !== player),
      });
    } else {
      if (multiWinners.length >= 3) return; // 最大3名
      const isOya = player === currentDealer;
      const defaultScore = isOya ? 1500 : 1000;
      updateDraft({
        multiWinners: [
          ...multiWinners,
          { winner: player, score: defaultScore, han: 1, fu: 30 },
        ],
      });
    }
  };

  // ダブロン時の特定和了者の打点更新
  const handleUpdateMultiScore = (pName: string, pts: number, h: number, f: number) => {
    updateDraft({
      multiWinners: multiWinners.map((w) =>
        w.winner === pName ? { ...w, score: pts, han: h, fu: f } : w
      ),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-neutral-900 border-t sm:border border-neutral-800 rounded-t-2xl sm:rounded-2xl p-4 shadow-2xl flex flex-col gap-3.5 max-h-[94dvh] overflow-y-auto">
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-white">
              {winType === 'ron' || winType === 'tsumo' || winType === 'multi_ron'
                ? '和了入力'
                : winType === 'ryukyoku' || winType === 'mid_ryukyoku'
                ? '流局入力'
                : 'チョンボ入力'}
            </span>
            <span className="text-xs font-bold text-neutral-400">
              {roundName} {honba}本場 (供託{riichiSticks}本)
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-300 font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* ─── 和了フロー (ロン / ツモ / ダブロン) ─── */}
        {(winType === 'ron' || winType === 'tsumo' || winType === 'multi_ron') && (
          <div className="flex flex-col gap-3">
            {/* Step 0: 関係者・種別指定 */}
            {step === 0 && (
              <WinnerAndLoserStep
                players={players}
                currentDealer={currentDealer}
                winType={winType}
                winner={winner}
                loser={loser}
                multiWinners={multiWinNames}
                allowMultiRon={allowMultiRon}
                onSelectWinType={(t) => updateDraft({ winType: t })}
                onSelectWinner={(p) => updateDraft({ winner: p })}
                onSelectLoser={(p) => updateDraft({ loser: p })}
                onToggleMultiWinner={handleToggleMultiWinner}
                onNext={() => setStep(1)}
              />
            )}

            {/* Step 1: 点数指定 (3x4グリッド) */}
            {step === 1 && (
              <ScoreStep
                winner={winner}
                winType={winType}
                currentDealer={currentDealer}
                multiWinners={multiWinners}
                onSelectSingleScore={(p) => updateDraft({ han: p.han, fu: p.fu })}
                onUpdateMultiWinnerScore={handleUpdateMultiScore}
                onBack={() => setStep(0)}
                onNext={() => setStep(2)}
              />
            )}

            {/* Step 2: 最終確認 */}
            {step === 2 && (
              <ConfirmStep
                winner={winner}
                loser={loser}
                winType={winType}
                baseScore={baseScore}
                honba={honba}
                riichiSticks={riichiSticks}
                honbaPt={honbaPt}
                riichiPt={riichiPt}
                totalReceive={totalReceive}
                multiWinners={multiWinners}
                closestWinner={closestWinner}
                submitting={submitting}
                onCommit={handleFinalCommit}
                onBack={() => setStep(1)}
              />
            )}
          </div>
        )}

        {/* ─── 流局フロー ─── */}
        {(winType === 'ryukyoku' || winType === 'mid_ryukyoku') && (
          <RyukyokuStep
            players={players}
            tenpai={tenpai}
            submitting={submitting}
            ruleConfig={ruleConfig}
            allowMidRyukyoku={allowMidRyukyoku}
            selectedMidType={ryukyokuType}
            onSelectMidType={(t) => updateDraft({ ryukyokuType: t })}
            onToggleTenpai={(p) => {
              const next = tenpai.includes(p)
                ? tenpai.filter((t) => t !== p)
                : [...tenpai, p];
              updateDraft({ tenpai: next });
            }}
            onCommitNormal={() => {
              updateDraft({ winType: 'ryukyoku' });
              handleFinalCommit();
            }}
            onCommitMid={() => {
              updateDraft({ winType: 'mid_ryukyoku' });
              handleFinalCommit();
            }}
          />
        )}

        {/* ─── チョンボフロー ─── */}
        {winType === 'chombo' && (
          <ChomboStep
            players={players}
            chomboPlayer={chomboPlayer}
            submitting={submitting}
            onSelectChomboPlayer={(p) => updateDraft({ chomboPlayer: p })}
            onCommit={handleFinalCommit}
          />
        )}
      </div>
    </div>
  );
};
