/**
 * 流局 ＆ チョンボ入力ステップ (通常流局 ＋ 途中流局対応版)
 */

'use client';

import React, { useState } from 'react';
import { RuleConfig } from '@/types/mahjong';

interface RyukyokuStepProps {
  players: string[];
  tenpai: string[];
  riichiDeclared?: string[];
  submitting: boolean;
  ruleConfig: RuleConfig;
  allowMidRyukyoku: boolean;
  selectedMidType: string;
  onSelectMidType: (type: string) => void;
  onToggleTenpai: (player: string) => void;
  onCommitNormal: () => void;
  onCommitMid: (midType: string) => void;
}

export const MID_RYUKYOKU_TYPES = [
  { id: 'kyushu', label: '九種九牌' },
  { id: 'four_wind', label: '四風連打' },
  { id: 'four_riichi', label: '四家立直' },
  { id: 'four_kan', label: '四開槓' },
  { id: 'sanchaho', label: '三家和' },
  { id: 'other', label: 'その他' },
];

export const RyukyokuStep: React.FC<RyukyokuStepProps> = ({
  players,
  tenpai,
  riichiDeclared = [],
  submitting,
  ruleConfig,
  allowMidRyukyoku,
  selectedMidType,
  onSelectMidType,
  onToggleTenpai,
  onCommitNormal,
  onCommitMid,
}) => {
  const [tab, setTab] = useState<'normal' | 'mid'>('normal');

  const effectiveTenpai = Array.from(new Set([...tenpai, ...riichiDeclared]));
  const bappuTotal = ruleConfig.detail?.noten_bappu_pt ?? 3000;
  const nT = effectiveTenpai.length;
  const nN = 4 - nT;

  const bappuSummaryText = (() => {
    if (nT === 0 || nT === 4) {
      return '受渡なし (場0点)';
    }
    const eachTenpai = Math.floor(bappuTotal / nT);
    const eachNoten = Math.floor(bappuTotal / nN);
    return `テンパイ +${eachTenpai.toLocaleString()}点 / ノーテン -${eachNoten.toLocaleString()}点`;
  })();

  return (
    <div className="flex flex-col gap-3.5">
      {/* ─── 流局種別タブ（途中流局が有効な場合のみ切替表示） ─── */}
      {allowMidRyukyoku && (
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-neutral-950 rounded-xl border border-neutral-800">
          <button
            type="button"
            onClick={() => setTab('normal')}
            className={`h-10 rounded-lg font-black text-xs transition-all ${
              tab === 'normal'
                ? 'bg-neutral-800 text-white shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            荒廃流局 (ノーテン罰符)
          </button>
          <button
            type="button"
            onClick={() => setTab('mid')}
            className={`h-10 rounded-lg font-black text-xs transition-all ${
              tab === 'mid'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            途中流局 (九種・四風等)
          </button>
        </div>
      )}

      {/* ─── 通常流局（荒廃流局） ─── */}
      {tab === 'normal' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-black text-neutral-300">
            テンパイしているプレイヤーを選択 (複数可)
          </p>

          <div className="grid grid-cols-2 gap-2">
            {players.map((p) => {
              const isRiichi = riichiDeclared.includes(p);
              const isTenpai = isRiichi || tenpai.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  disabled={isRiichi}
                  onClick={() => !isRiichi && onToggleTenpai(p)}
                  className={`h-14 rounded-xl text-sm flex items-center justify-center transition-all touch-manipulation ${
                    isRiichi
                      ? 'bg-neutral-900 border border-neutral-700 text-neutral-300 cursor-default opacity-80'
                      : isTenpai
                      ? 'bg-neutral-800 border-2 border-white text-white font-black shadow-xs'
                      : 'bg-neutral-900 border border-neutral-800 text-neutral-400 font-bold hover:border-neutral-700'
                  }`}
                >
                  <span>{p}</span>
                  {isRiichi ? (
                    <span className="text-xs ml-1.5 text-neutral-300 font-bold">
                      (立直・聴牌)
                    </span>
                  ) : (
                    <span className={`text-xs ml-1.5 font-black ${isTenpai ? 'text-white' : 'text-neutral-500'}`}>
                      ({isTenpai ? '聴牌' : '不聴'})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ノーテン罰符精算（押せない情報表示：四角枠を排して区切り線のみ） */}
          <div className="pt-2 pb-1 border-t border-neutral-800 flex items-center justify-between text-xs">
            <span className="font-bold text-neutral-400">ノーテン罰符</span>
            <span className="text-white font-mono font-black">
              {bappuSummaryText}
            </span>
          </div>

          {/* 確定ボタン（白背景・黒太字・全幅の最優先アクション） */}
          <button
            type="button"
            disabled={submitting}
            onClick={onCommitNormal}
            className="w-full h-13 rounded-xl bg-white hover:bg-neutral-200 active:scale-[0.99] disabled:opacity-40 text-black font-black text-sm shadow-md transition-all flex items-center justify-center"
          >
            {submitting ? '記録中...' : '流局を確定して次局へ →'}
          </button>
        </div>
      )}

      {/* ─── 途中流局 ─── */}
      {tab === 'mid' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-black text-neutral-300">
            途中流局の理由を選択
          </p>

          <div className="grid grid-cols-2 gap-2">
            {MID_RYUKYOKU_TYPES.map((t) => {
              const isSelected = selectedMidType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectMidType(t.id)}
                  className={`h-13 rounded-xl text-sm flex items-center justify-center transition-all touch-manipulation ${
                    isSelected
                      ? 'bg-neutral-800 border-2 border-white text-white font-black shadow-xs'
                      : 'bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-400 font-bold'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* 途中流局情報（四角枠を排して区切り線のみ） */}
          <div className="pt-2 pb-1 border-t border-neutral-800 flex flex-col gap-1 text-xs">
            <div className="flex items-center justify-between font-bold">
              <span className="text-neutral-400">罰符受渡</span>
              <span className="text-white font-mono font-black">なし (0点移動)</span>
            </div>
            <div className="text-[11px] text-neutral-500">
              ※本場は+1されます。連荘または輪荘はルール設定に従って自動判定されます。
            </div>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={() => onCommitMid(selectedMidType)}
            className="w-full h-13 rounded-xl bg-white hover:bg-neutral-200 active:scale-[0.99] disabled:opacity-40 text-black font-black text-sm shadow-md transition-all flex items-center justify-center"
          >
            {submitting ? '記録中...' : '途中流局を確定して次局へ →'}
          </button>
        </div>
      )}
    </div>
  );
};

interface ChomboStepProps {
  players: string[];
  chomboPlayer: string | null;
  submitting: boolean;
  onSelectChomboPlayer: (player: string) => void;
  onCommit: () => void;
}

export const ChomboStep: React.FC<ChomboStepProps> = ({
  players,
  chomboPlayer,
  submitting,
  onSelectChomboPlayer,
  onCommit,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-black text-neutral-200">
        チョンボをしたプレイヤーを選択
      </p>
      <div className="grid grid-cols-2 gap-2">
        {players.map((p) => {
          const isSelected = chomboPlayer === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onSelectChomboPlayer(p)}
              className={`h-14 rounded-xl text-base flex items-center justify-center transition-all ${
                isSelected
                  ? 'bg-neutral-800 border-2 border-white text-white font-black shadow-xs'
                  : 'bg-neutral-900 border border-neutral-800 text-neutral-400 font-bold'
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>

      <div className="pt-2 pb-1 border-t border-neutral-800 flex items-center justify-between text-xs">
        <span className="font-bold text-neutral-400">チョンボ精算</span>
        <span className="text-neutral-200 font-bold">
          満貫払い（親: 子各4000点 / 子: 親4000点・子各2000点）
        </span>
      </div>

      <button
        type="button"
        disabled={!chomboPlayer || submitting}
        onClick={onCommit}
        className={`w-full h-13 rounded-xl font-black text-sm shadow-md transition-all flex items-center justify-center ${
          chomboPlayer
            ? 'bg-white hover:bg-neutral-200 active:scale-[0.99] disabled:opacity-40 text-black'
            : 'bg-neutral-850 text-neutral-600 border border-neutral-800 cursor-not-allowed'
        }`}
      >
        {submitting ? '記録中...' : 'チョンボを確定（同局やり直し） →'}
      </button>
    </div>
  );
};
