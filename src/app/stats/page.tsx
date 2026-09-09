/**
 * 成績集計画面 (個人スタッツ、順位分布、和了率・放銃率)
 * docs/DETAILED_DESIGN.md 第10項準拠
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface PlayerStats {
  playerName: string;
  gamesCount: number;
  totalPoint: number;
  avgRank: number;
  ranks: [number, number, number, number]; // [1位, 2位, 3位, 4位]
  avgScore: number;
  agariRate: number; // 和了率 (%)
  houjuRate: number; // 放銃率 (%)
  riichiRate: number; // 立直率 (%)
}

export default function StatsPage() {
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'point' | 'avgRank' | 'games'>('point');

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);

        // 1. 全参加者レコード取得
        const { data: participants } = await supabase
          .from('game_participants')
          .select('player_name_snapshot, rank, point, final_score, member_id');

        // 2. 全局座席レコード取得 (和了・放銃・立直集計用)
        const { data: roundSeats } = await supabase
          .from('round_seats')
          .select('member_id, is_winner, is_loser, is_riichi');

        const partList: any[] = (participants as any[]) || [];
        const seatList: any[] = (roundSeats as any[]) || [];

        if (partList.length === 0) return;

        // プレイヤーごとに集約
        const playerMap = new Map<
          string,
          {
            name: string;
            games: number;
            totalPt: number;
            ranks: [number, number, number, number];
            totalScore: number;
            memberIds: Set<string>;
          }
        >();

        for (const p of partList) {
          const name = p.player_name_snapshot;
          if (!playerMap.has(name)) {
            playerMap.set(name, {
              name,
              games: 0,
              totalPt: 0,
              ranks: [0, 0, 0, 0],
              totalScore: 0,
              memberIds: new Set(),
            });
          }
          const item = playerMap.get(name)!;
          item.games += 1;
          item.totalPt += Number(p.point);
          if (p.rank >= 1 && p.rank <= 4) {
            item.ranks[p.rank - 1] += 1;
          }
          item.totalScore += p.final_score;
          if (p.member_id) {
            item.memberIds.add(p.member_id);
          }
        }

        // ラウンド集計 (メンバー名 or member_id 照合)
        const roundMap = new Map<
          string,
          { rounds: number; agari: number; houju: number; riichi: number }
        >();

        if (seatList.length > 0) {
          for (const s of seatList) {
            const mId = s.member_id;
            if (!roundMap.has(mId)) {
              roundMap.set(mId, { rounds: 0, agari: 0, houju: 0, riichi: 0 });
            }
            const r = roundMap.get(mId)!;
            r.rounds += 1;
            if (s.is_winner === 1) r.agari += 1;
            if (s.is_loser === 1) r.houju += 1;
            if (s.is_riichi === 1) r.riichi += 1;
          }
        }

        // PlayerStats 配列を生成
        const result: PlayerStats[] = Array.from(playerMap.values()).map((p) => {
          const avgRank =
            p.games > 0
              ? (p.ranks[0] * 1 +
                  p.ranks[1] * 2 +
                  p.ranks[2] * 3 +
                  p.ranks[3] * 4) /
                p.games
              : 0;

          // このプレイヤーのmemberIdsに該当するラウンド数を合計
          let totalRounds = 0;
          let totalAgari = 0;
          let totalHouju = 0;
          let totalRiichi = 0;

          for (const mId of p.memberIds) {
            const rData = roundMap.get(mId) || roundMap.get(p.name);
            if (rData) {
              totalRounds += rData.rounds;
              totalAgari += rData.agari;
              totalHouju += rData.houju;
              totalRiichi += rData.riichi;
            }
          }

          return {
            playerName: p.name,
            gamesCount: p.games,
            totalPoint: Math.round(p.totalPt * 10) / 10,
            avgRank: Math.round(avgRank * 100) / 100,
            ranks: p.ranks,
            avgScore: Math.round(p.totalScore / (p.games || 1)),
            agariRate:
              totalRounds > 0
                ? Math.round((totalAgari / totalRounds) * 1000) / 10
                : 0,
            houjuRate:
              totalRounds > 0
                ? Math.round((totalHouju / totalRounds) * 1000) / 10
                : 0,
            riichiRate:
              totalRounds > 0
                ? Math.round((totalRiichi / totalRounds) * 1000) / 10
                : 0,
          };
        });

        setStats(result);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  // ソート処理
  const sortedStats = [...stats].sort((a, b) => {
    if (sortBy === 'point') return b.totalPoint - a.totalPoint;
    if (sortBy === 'avgRank') return a.avgRank - b.avgRank;
    if (sortBy === 'games') return b.gamesCount - a.gamesCount;
    return 0;
  });

  return (
    <main className="min-h-screen bg-black text-white max-w-xl mx-auto p-4 flex flex-col gap-5">
      {/* ヘッダー */}
      <header className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            成績集計・ランキング
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5 font-bold">
            クラウド同期データ（全{stats.reduce((s, p) => s + p.gamesCount, 0) / 4}対局）
          </p>
        </div>

        <Link
          href="/"
          className="text-xs text-neutral-300 hover:text-white font-bold py-2 px-3 rounded-xl bg-neutral-900 border border-neutral-800 transition-colors"
        >
          &larr; ホームへ戻る
        </Link>
      </header>

      {/* ソートセレクター */}
      <div className="flex items-center gap-2 bg-neutral-900 p-1.5 rounded-xl border border-neutral-800">
        <span className="text-xs font-black text-neutral-400 pl-2">並び順:</span>
        <div className="grid grid-cols-3 gap-1 flex-1">
          {[
            { id: 'point', label: '通算pt順' },
            { id: 'avgRank', label: '平均順位順' },
            { id: 'games', label: '対局数順' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSortBy(item.id as any)}
              className={`py-2 rounded-lg text-xs font-black transition-all ${
                sortBy === item.id
                  ? 'bg-amber-500 text-black shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ランキング一覧 */}
      {loading ? (
        <div className="p-8 text-center text-neutral-500 text-xs font-bold">
          集計中...
        </div>
      ) : sortedStats.length === 0 ? (
        <div className="p-8 text-center text-neutral-500 text-xs font-bold bg-neutral-900 rounded-xl border border-neutral-800">
          対局データがありません
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sortedStats.map((p, idx) => {
            const topRate =
              p.gamesCount > 0
                ? Math.round((p.ranks[0] / p.gamesCount) * 1000) / 10
                : 0;
            const renchanRate =
              p.gamesCount > 0
                ? Math.round(((p.ranks[0] + p.ranks[1]) / p.gamesCount) * 1000) / 10
                : 0;
            const lastAvoidRate =
              p.gamesCount > 0
                ? Math.round(((p.gamesCount - p.ranks[3]) / p.gamesCount) * 1000) / 10
                : 0;

            return (
              <div
                key={p.playerName}
                className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-3 shadow-xs"
              >
                {/* プレイヤー名 ＆ 通算pt */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                        idx === 0
                          ? 'bg-amber-400 text-black'
                          : idx === 1
                          ? 'bg-neutral-300 text-black'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="font-black text-base sm:text-lg text-white">
                      {p.playerName}
                    </span>
                    <span className="text-xs font-bold text-neutral-400">
                      ({p.gamesCount}戦)
                    </span>
                  </div>

                  <span
                    className={`text-xl font-black ${
                      p.totalPoint > 0
                        ? 'text-cyan-400'
                        : p.totalPoint < 0
                        ? 'text-rose-500'
                        : 'text-neutral-300'
                    }`}
                  >
                    {p.totalPoint > 0 ? `+${p.totalPoint.toFixed(1)}` : p.totalPoint.toFixed(1)} pt
                  </span>
                </div>

                {/* 順位分布バー */}
                <div className="flex flex-col gap-1.5">
                  <div className="h-3 w-full rounded-full bg-neutral-800 overflow-hidden flex">
                    <div
                      style={{ width: `${(p.ranks[0] / p.gamesCount) * 100}%` }}
                      className="bg-amber-400"
                      title={`1位: ${p.ranks[0]}回`}
                    ></div>
                    <div
                      style={{ width: `${(p.ranks[1] / p.gamesCount) * 100}%` }}
                      className="bg-cyan-500"
                      title={`2位: ${p.ranks[1]}回`}
                    ></div>
                    <div
                      style={{ width: `${(p.ranks[2] / p.gamesCount) * 100}%` }}
                      className="bg-neutral-500"
                      title={`3位: ${p.ranks[2]}回`}
                    ></div>
                    <div
                      style={{ width: `${(p.ranks[3] / p.gamesCount) * 100}%` }}
                      className="bg-rose-600"
                      title={`4位: ${p.ranks[3]}回`}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-neutral-400 px-0.5">
                    <span className="text-amber-300">1位: {p.ranks[0]}</span>
                    <span className="text-cyan-300">2位: {p.ranks[1]}</span>
                    <span className="text-neutral-300">3位: {p.ranks[2]}</span>
                    <span className="text-rose-400">4位: {p.ranks[3]}</span>
                  </div>
                </div>

                {/* 指標グリッド (2段表示) */}
                <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-neutral-800 text-center">
                  <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-800">
                    <span className="text-[10px] font-bold text-neutral-500 block">平均順位</span>
                    <span className="text-sm font-black text-neutral-200">
                      {p.avgRank.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-800">
                    <span className="text-[10px] font-bold text-neutral-500 block">トップ率</span>
                    <span className="text-sm font-black text-amber-300">
                      {topRate}%
                    </span>
                  </div>
                  <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-800">
                    <span className="text-[10px] font-bold text-neutral-500 block">連対率</span>
                    <span className="text-sm font-black text-cyan-300">
                      {renchanRate}%
                    </span>
                  </div>
                  <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-800">
                    <span className="text-[10px] font-bold text-neutral-500 block">ラス回避率</span>
                    <span className="text-sm font-black text-neutral-200">
                      {lastAvoidRate}%
                    </span>
                  </div>
                </div>

                {/* 和了・放銃・立直・平均素点 */}
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-800">
                    <span className="text-[10px] font-bold text-neutral-500 block">和了率</span>
                    <span className="text-xs font-black text-rose-400">
                      {p.agariRate}%
                    </span>
                  </div>
                  <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-800">
                    <span className="text-[10px] font-bold text-neutral-500 block">放銃率</span>
                    <span className="text-xs font-black text-neutral-300">
                      {p.houjuRate}%
                    </span>
                  </div>
                  <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-800">
                    <span className="text-[10px] font-bold text-neutral-500 block">立直率</span>
                    <span className="text-xs font-black text-amber-400">
                      {p.riichiRate}%
                    </span>
                  </div>
                  <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-800">
                    <span className="text-[10px] font-bold text-neutral-500 block">平均素点</span>
                    <span className="text-xs font-black text-neutral-200">
                      {Math.round(p.avgScore).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
