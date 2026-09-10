/**
 * 対局詳細ポップアップモーダルコンポーネント (GameDetailModal.tsx)
 * 該当対局の最終順位、素点、pt、および各局の履歴一覧表示
 */

'use client';

import React from 'react';
import { GameData, RoundData } from '@/lib/mahjong/statsCalc';

interface GameDetailModalProps {
  game: GameData | null;
  rounds: RoundData[];
  onClose: () => void;
}

export const GameDetailModal: React.FC<GameDetailModalProps> = ({
  game,
  rounds,
  onClose,
}) => {
  if (!game) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col gap-4 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div>
            <h3 className="text-base font-black text-white">対局詳細</h3>
            <p className="text-xs text-neutral-400 font-bold mt-0.5">
              {game.played_at.slice(0, 16).replace('T', ' ')} / {game.rule_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 text-neutral-400 hover:text-white text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* 最終順位 */}
        <div>
          <span className="text-xs font-black text-neutral-400 block mb-1.5">最終成績</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {game.participants.map((p) => (
              <div key={p.seat} className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col">
                <div className="flex items-center justify-between text-[11px] font-bold text-neutral-400">
                  <span>{p.rank}位</span>
                  <span>{p.final_score.toLocaleString()}点</span>
                </div>
                <span className="text-sm font-black text-white mt-1">{p.name}</span>
                <span
                  className={`text-xs font-black font-mono mt-0.5 ${
                    p.point > 0 ? 'text-cyan-400' : p.point < 0 ? 'text-rose-500' : 'text-neutral-300'
                  }`}
                >
                  {p.point.toFixed(1)} pt
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 各局詳細 */}
        <div>
          <span className="text-xs font-black text-neutral-400 block mb-1.5">
            局履歴（全 {rounds.length} 局）
          </span>
          {rounds.length === 0 ? (
            <div className="p-4 text-center text-neutral-500 text-xs font-bold bg-neutral-950 rounded-xl border border-neutral-800">
              詳細局データがありません。
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {rounds.map((r, idx) => (
                <div key={r.round_id || idx} className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs">
                  <div className="flex items-center justify-between font-black">
                    <span className="text-white">{r.kyoku_name} {r.honba > 0 && `(${r.honba}本場)`}</span>
                    <span className="text-amber-400">
                      {r.result_type === 'tsumo' ? 'ツモ和了' : r.result_type === 'ron' ? 'ロン和了' : '流局'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-black transition-colors mt-1"
        >
          閉じる
        </button>
      </div>
    </div>
  );
};
