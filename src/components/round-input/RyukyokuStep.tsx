/**
 * 流局 ＆ チョンボ入力ステップ (通常流局 ＋ 途中流局対応版)
 */

'use client';

import React, { useState } from 'react';
import { RuleConfig } from '@/types/mahjong';

const SEAT_NAMES = ['東', '南', '西', '北'];

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
  currentDealer?: string;
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
  currentDealer,
}) => {
  const [tab, setTab] = useState<'normal' | 'mid'>('normal');

  const effectiveTenpai = Array.from(new Set([...tenpai, ...riichiDeclared]));
  const bappuTotal = ruleConfig.detail?.noten_bappu_pt ?? 3000;
  const nT = effectiveTenpai.length;
  const nN = 4 - nT;

  const eachTenpai = nT > 0 && nT < 4 ? Math.floor(bappuTotal / nT) : 0;
  const eachNoten = nN > 0 && nT > 0 && nT < 4 ? Math.floor(bappuTotal / nN) : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* ─── 流局種別タブ（途中流局が有効な場合のみ切替表示） ─── */}
      {allowMidRyukyoku && (
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-neutral-950 rounded-xl border border-neutral-800">
          <button
            type="button"
            onClick={() => setTab('normal')}
            className={`h-10 rounded-lg font-black text-xs transition-all ${
              tab === 'normal'
                ? 'bg-white text-black shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            荒廃流局
          </button>
          <button
            type="button"
            onClick={() => setTab('mid')}
            className={`h-10 rounded-lg font-black text-xs transition-all ${
              tab === 'mid'
                ? 'bg-white text-black shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            途中流局
          </button>
        </div>
      )}

      {/* ─── 通常流局（荒廃流局） ─── */}
      {tab === 'normal' && (
        <div className="flex flex-col gap-2.5">
          {/* 4名プレイヤートグルグリッド */}
          <div className="grid grid-cols-2 gap-2">
            {players.map((p, idx) => {
              const isRiichi = riichiDeclared.includes(p);
              const isTenpai = isRiichi || tenpai.includes(p);
              const isDealer = p === currentDealer;
              const seat = SEAT_NAMES[idx] || '';

              // 立直者: 白背景・聴牌固定
              if (isRiichi) {
                return (
                  <div
                    key={p}
                    className="h-14 rounded-xl px-3 border-2 border-white bg-white text-black shadow-md flex items-center justify-between cursor-default"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold w-4 text-center text-neutral-600 shrink-0">
                        {seat}
                      </span>
                      <span className="truncate text-base font-black text-black">{p}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isDealer && (
                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-rose-600 text-white">
                          親
                        </span>
                      )}
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-neutral-950 text-amber-300 border border-neutral-700">
                        立直
                      </span>
                    </div>
                  </div>
                );
              }

              // 一般プレイヤー: タップで聴牌/不聴をトグル
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onToggleTenpai(p)}
                  className={`h-14 rounded-xl px-3 flex items-center justify-between transition-all touch-manipulation cursor-pointer ${
                    isTenpai
                      ? 'border-2 border-white bg-white text-black shadow-md'
                      : 'border border-neutral-800 bg-neutral-950 hover:bg-neutral-850'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-xs font-bold w-4 text-center shrink-0 ${
                        isTenpai ? 'text-neutral-600' : 'text-neutral-500'
                      }`}
                    >
                      {seat}
                    </span>
                    <span
                      className={`truncate text-base font-black ${
                        isTenpai ? 'text-black' : 'text-neutral-400'
                      }`}
                    >
                      {p}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isDealer && (
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.2 rounded bg-rose-600 text-white ${
                          !isTenpai ? 'opacity-50' : ''
                        }`}
                      >
                        親
                      </span>
                    )}
                    <span
                      className={`text-xs font-black px-2 py-0.5 rounded shrink-0 ${
                        isTenpai
                          ? 'bg-black text-white'
                          : 'bg-neutral-900 text-neutral-500 font-bold'
                      }`}
                    >
                      {isTenpai ? '聴牌' : '不聴'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ノーテン罰符 収支明細カード */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs pb-1 border-b border-neutral-850">
              <span className="text-neutral-400 font-bold">ノーテン罰符</span>
              <span className="text-[11px] font-mono text-neutral-500">
                {nT === 0 || nT === 4 ? '受渡なし' : `${nT}名聴牌`}
              </span>
            </div>

            {/* 各自の収支一覧 */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-0.5 text-xs font-mono">
              {players.map((p, idx) => {
                const isTenpai = effectiveTenpai.includes(p);
                const isNoMove = nT === 0 || nT === 4;

                let scoreText = '±0点';
                let scoreClass = 'font-bold text-neutral-500';

                if (!isNoNoMove(nT)) {
                  if (isTenpai) {
                    scoreText = `+${eachTenpai}点`;
                    scoreClass = 'font-black text-amber-300';
                  } else {
                    scoreText = `-${eachNoten}点`;
                    scoreClass = 'font-bold text-neutral-400';
                  }
                }

                return (
                  <div
                    key={p}
                    className={`flex items-center justify-between py-0.5 ${
                      idx < 2 ? 'border-b border-neutral-900' : ''
                    }`}
                  >
                    <span
                      className={`font-sans ${
                        isTenpai ? 'text-neutral-200 font-bold' : 'text-neutral-400'
                      }`}
                    >
                      {p}
                    </span>
                    <span className={scoreClass}>{scoreText}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 確定ボタン（赤色化） */}
          <button
            type="button"
            disabled={submitting}
            onClick={onCommitNormal}
            className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.99] disabled:opacity-40 text-white font-black text-sm shadow-md transition-all flex items-center justify-center cursor-pointer mt-0.5"
          >
            {submitting ? '記録中...' : '流局を確定して次局へ →'}
          </button>
        </div>
      )}

      {/* ─── 途中流局 ─── */}
      {tab === 'mid' && (
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2">
            {MID_RYUKYOKU_TYPES.map((t) => {
              const isSelected = selectedMidType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectMidType(t.id)}
                  className={`h-12 rounded-xl text-sm flex items-center justify-center transition-all touch-manipulation cursor-pointer ${
                    isSelected
                      ? 'bg-white border-2 border-white text-black font-black shadow-xs'
                      : 'bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 text-neutral-400 font-bold'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 flex items-center justify-between text-xs font-bold">
            <span className="text-neutral-400">罰符受渡</span>
            <span className="text-white font-mono font-black">なし (0点移動)</span>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={() => onCommitMid(selectedMidType)}
            className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.99] disabled:opacity-40 text-white font-black text-sm shadow-md transition-all flex items-center justify-center cursor-pointer mt-0.5"
          >
            {submitting ? '記録中...' : '途中流局を確定して次局へ →'}
          </button>
        </div>
      )}
    </div>
  );
};

// ヘルパー: 受渡なし判定
function isNoNoMove(nT: number): boolean {
  return nT === 0 || nT === 4;
}

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
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2">
        {players.map((p) => {
          const isSelected = chomboPlayer === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onSelectChomboPlayer(p)}
              className={`h-14 rounded-xl text-base flex items-center justify-center transition-all cursor-pointer ${
                isSelected
                  ? 'bg-white border-2 border-white text-black font-black shadow-xs'
                  : 'bg-neutral-950 border border-neutral-800 text-neutral-400 font-bold hover:border-neutral-700'
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>

      <div className="pt-2 pb-1 border-t border-neutral-800 flex items-center justify-between text-xs">
        <span className="font-bold text-neutral-400">チョンボ精算</span>
        <span className="text-neutral-200 font-bold font-mono">
          満貫払い
        </span>
      </div>

      <button
        type="button"
        disabled={!chomboPlayer || submitting}
        onClick={onCommit}
        className={`w-full h-12 rounded-xl font-black text-sm shadow-md transition-all flex items-center justify-center cursor-pointer ${
          chomboPlayer
            ? 'bg-red-600 hover:bg-red-500 active:scale-[0.99] text-white'
            : 'bg-neutral-850 text-neutral-600 border border-neutral-800 cursor-not-allowed'
        }`}
      >
        {submitting ? '記録中...' : 'チョンボを確定（同局やり直し） →'}
      </button>
    </div>
  );
};
