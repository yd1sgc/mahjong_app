/**
 * 流局 ＆ チョンボ入力ステップ (通常流局 ＋ 途中流局対応版)
 */

'use client';

import React, { useState } from 'react';
import { RuleConfig } from '@/types/mahjong';

interface RyukyokuStepProps {
  players: string[];
  tenpai: string[];
  submitting: boolean;
  ruleConfig: RuleConfig;
  allowMidRyukyoku: boolean;
  selectedMidType: string;
  onSelectMidType: (type: string) => void;
  onToggleTenpai: (player: string) => void;
  onCommitNormal: () => void;
  onCommitMid: () => void;
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

  const bappuTotal = ruleConfig.detail?.noten_bappu_pt ?? 3000;
  const nT = tenpai.length;
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
              const isTenpai = tenpai.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onToggleTenpai(p)}
                  className={`h-14 rounded-xl font-black text-sm flex items-center justify-center transition-all border touch-manipulation ${
                    isTenpai
                      ? 'bg-cyan-600/30 border-cyan-400 text-cyan-200 shadow-xs'
                      : 'bg-neutral-850 border-neutral-700/80 text-neutral-300'
                  }`}
                >
                  <span>{p}</span>
                  <span className="text-xs ml-1.5 opacity-80">
                    ({isTenpai ? '聴牌' : '不聴'})
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-xs font-bold text-neutral-400 flex items-center justify-between">
            <span>ノーテン罰符精算</span>
            <span className="text-neutral-200 font-mono font-bold">
              {bappuSummaryText}
            </span>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={onCommitNormal}
            className="w-full h-12 rounded-xl bg-neutral-750 hover:bg-neutral-700 active:bg-neutral-600 disabled:opacity-50 text-white font-black text-sm shadow-md transition-all flex items-center justify-center"
          >
            {submitting ? '記録中...' : '流局を確定して次局へ'}
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
                  className={`h-13 rounded-xl font-black text-sm flex items-center justify-center border transition-all touch-manipulation ${
                    isSelected
                      ? 'bg-amber-600/30 border-amber-400 text-amber-300 shadow-xs'
                      : 'bg-neutral-850 hover:bg-neutral-800 border-neutral-700/80 text-neutral-300'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-xs font-bold text-neutral-400 flex flex-col gap-1">
            <div className="flex items-center justify-between text-neutral-300 font-bold">
              <span>罰符受渡</span>
              <span>なし (0点移動)</span>
            </div>
            <div className="text-[11px] text-neutral-500">
              ※本場は+1されます。連荘または輪荘はルール設定に従って自動判定されます。
            </div>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={onCommitMid}
            className="w-full h-12 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-400 disabled:opacity-50 text-white font-black text-sm shadow-md transition-all flex items-center justify-center"
          >
            {submitting ? '記録中...' : '途中流局を確定して次局へ'}
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
              className={`h-14 rounded-xl font-black text-base flex items-center justify-center transition-all border ${
                isSelected
                  ? 'bg-rose-600/30 border-rose-500 text-rose-300 shadow-sm'
                  : 'bg-neutral-850 border-neutral-700/80 text-neutral-300'
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>

      <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-xs font-bold text-neutral-400 flex items-center justify-between">
        <span>チョンボ精算</span>
        <span className="text-neutral-200">
          満貫払い（親: 子各4000点 / 子: 親4000点・子各2000点）
        </span>
      </div>

      <button
        type="button"
        disabled={!chomboPlayer || submitting}
        onClick={onCommit}
        className={`w-full h-12 rounded-xl font-black text-sm shadow-md transition-all flex items-center justify-center ${
          chomboPlayer
            ? 'bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white'
            : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
        }`}
      >
        {submitting ? '記録中...' : 'チョンボを確定（同局やり直し）'}
      </button>
    </div>
  );
};
