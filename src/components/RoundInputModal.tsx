/**
 * 局結果入力モーダルコンポーネント
 * mahjong_personal 準拠：ステップ式ウィザード（誰が和了 → ロン/ツモ → 点数プリセット → 放銃者 → 確認）
 * LocalStorage即時下書き保存 ＋ 二重送信物理防止（disabled）
 * 
 * 各ステップUIを src/components/round-input/ 配下に分離し、本ファイルは状態統合に特化
 */

'use client';

import React, { useEffect, useState } from 'react';
import { calculateScore } from '@/lib/mahjong/calc';
import { getDealer, getRoundName } from '@/lib/mahjong/rules';
import { RoundRecord, RuleConfig, WinType } from '@/types/mahjong';
import { RoundInputDraft } from '@/hooks/useGameDraft';
import { WinnerStep } from './round-input/WinnerStep';
import { WinTypeStep } from './round-input/WinTypeStep';
import { ScoreStep } from './round-input/ScoreStep';
import { LoserStep } from './round-input/LoserStep';
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
  updateDraft: (updater: Partial<RoundInputDraft>) => void;
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
  const [step, setStep] = useState(0); // 0: 和了者, 1: ロン/ツモ, 2: 点数, 3: 放銃者, 4: 確認

  const currentDealer = getDealer(players, roundIdx);
  const roundName = getRoundName(roundIdx);

  useEffect(() => {
    if (isOpen) {
      updateDraft({ winType: initialWinType });
      setStep(0);
    }
  }, [isOpen, initialWinType, updateDraft]);

  if (!isOpen) return null;

  const { winType, winner, loser, han, fu, tenpai, chomboPlayer } = draft;
  const isDealerWinner = winner === currentDealer;

  // 点数プレビュー計算
  let baseScore = 0;
  if (winType === 'ron' || winType === 'tsumo') {
    const isTsumo = winType === 'tsumo';
    const scoreRes = calculateScore(han || 1, fu || 30, isDealerWinner, isTsumo);
    baseScore = scoreRes.total;
  }
  const honbaPt = (ruleConfig.detail?.honba_pt ?? 300) * honba;
  const riichiPt = (ruleConfig.detail?.riichi_pt ?? 1000) * riichiSticks;
  const totalReceive = baseScore + honbaPt + riichiPt;

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

  // プリセット点数選択時の処理
  const handleSelectPreset = (p: { pts: number; han: number; fu: number }) => {
    updateDraft({ han: p.han, fu: p.fu });
    if (winType === 'tsumo') {
      setStep(4);
    } else {
      setStep(3);
    }
  };

  // 翻符手動計算適用
  const handleApplyCustomCalc = (h: number, f: number) => {
    updateDraft({ han: h, fu: f });
    if (winType === 'tsumo') {
      setStep(4);
    } else {
      setStep(3);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-neutral-900 border-t sm:border border-neutral-800 rounded-t-2xl sm:rounded-2xl p-4 shadow-2xl flex flex-col gap-3.5 max-h-[92dvh] overflow-y-auto">
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-white">
              {winType === 'ron' || winType === 'tsumo'
                ? '和了入力'
                : winType === 'ryukyoku'
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

        {/* ─── 和了フロー ─── */}
        {(winType === 'ron' || winType === 'tsumo') && (
          <div className="flex flex-col gap-3">
            {step === 0 && (
              <WinnerStep
                players={players}
                currentDealer={currentDealer}
                onSelectWinner={(p) => {
                  updateDraft({ winner: p });
                  setStep(1);
                }}
              />
            )}

            {step === 1 && (
              <WinTypeStep
                winner={winner}
                onSelectType={(type) => {
                  updateDraft({ winType: type });
                  setStep(2);
                }}
                onBack={() => setStep(0)}
              />
            )}

            {step === 2 && (
              <ScoreStep
                winner={winner}
                winType={winType}
                isDealerWinner={isDealerWinner}
                initialHan={han || 1}
                initialFu={fu || 30}
                onSelectPreset={handleSelectPreset}
                onApplyCustomCalc={handleApplyCustomCalc}
                onBack={() => setStep(1)}
              />
            )}

            {step === 3 && winType === 'ron' && (
              <LoserStep
                players={players}
                winner={winner}
                onSelectLoser={(p) => {
                  updateDraft({ loser: p });
                  setStep(4);
                }}
                onBack={() => setStep(2)}
              />
            )}

            {step === 4 && (
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
                submitting={submitting}
                onCommit={handleFinalCommit}
                onBack={() => setStep(winType === 'ron' ? 3 : 2)}
              />
            )}
          </div>
        )}

        {/* ─── 流局フロー ─── */}
        {winType === 'ryukyoku' && (
          <RyukyokuStep
            players={players}
            tenpai={tenpai}
            submitting={submitting}
            onToggleTenpai={(p) => {
              const next = tenpai.includes(p)
                ? tenpai.filter((t) => t !== p)
                : [...tenpai, p];
              updateDraft({ tenpai: next });
            }}
            onCommit={handleFinalCommit}
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
