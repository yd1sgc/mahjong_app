/**
 * 流局 ＆ チョンボ入力ステップ
 */

'use client';

import React from 'react';

interface RyukyokuStepProps {
  players: string[];
  tenpai: string[];
  submitting: boolean;
  onToggleTenpai: (player: string) => void;
  onCommit: () => void;
}

export const RyukyokuStep: React.FC<RyukyokuStepProps> = ({
  players,
  tenpai,
  submitting,
  onToggleTenpai,
  onCommit,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-black text-neutral-200">
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
              className={`h-16 rounded-xl font-black text-base flex items-center justify-center transition-all border ${
                isTenpai
                  ? 'bg-cyan-600/30 border-cyan-400 text-cyan-300 shadow-sm'
                  : 'bg-neutral-800 border-neutral-700 text-neutral-300'
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
        <span className="text-neutral-200">
          {tenpai.length === 0 || tenpai.length === 4
            ? '受渡なし (場0点)'
            : tenpai.length === 1
            ? 'テンパイ +3,000点 / ノーテン -1,000点'
            : tenpai.length === 2
            ? 'テンパイ +1,500点 / ノーテン -1,500点'
            : 'テンパイ +1,000点 / ノーテン -3,000点'}
        </span>
      </div>

      <button
        type="button"
        disabled={submitting}
        onClick={onCommit}
        className="w-full h-12 rounded-xl bg-neutral-700 hover:bg-neutral-600 active:bg-neutral-500 disabled:opacity-50 text-white font-black text-sm shadow-md transition-all flex items-center justify-center"
      >
        {submitting ? '記録中...' : '流局を確定して次局へ'}
      </button>
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
      <p className="text-sm font-black text-neutral-200">
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
              className={`h-16 rounded-xl font-black text-base flex items-center justify-center transition-all border ${
                isSelected
                  ? 'bg-rose-600/30 border-rose-500 text-rose-300 shadow-sm'
                  : 'bg-neutral-800 border-neutral-700 text-neutral-300'
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
          満貫払い（親: 子3名へ各4000点 / 子: 親へ4000点・子へ各2000点）
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
