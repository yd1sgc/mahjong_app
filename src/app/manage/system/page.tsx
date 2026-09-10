/**
 * データ・システム管理画面 (/manage/system)
 * クラウド同期状況・データ総件数の表示
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function SystemManagePage() {
  const [gamesCount, setGamesCount] = useState(0);
  const [roundsCount, setRoundsCount] = useState(0);
  const [membersCount, setMembersCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);

        const { count: gCount } = await supabase
          .from('games')
          .select('*', { count: 'exact', head: true });
        if (gCount !== null) setGamesCount(gCount);

        const { count: rCount } = await supabase
          .from('rounds')
          .select('*', { count: 'exact', head: true });
        if (rCount !== null) setRoundsCount(rCount);

        const { count: mCount } = await supabase
          .from('members')
          .select('*', { count: 'exact', head: true });
        if (mCount !== null) setMembersCount(mCount);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white max-w-xl mx-auto p-4 flex flex-col gap-6">
      {/* ヘッダー */}
      <header className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            データ・システム管理
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5 font-bold">
            クラウドデータベースの稼働ステータスと統計
          </p>
        </div>

        <Link
          href="/"
          className="text-xs text-neutral-300 hover:text-white font-bold py-2 px-3 rounded-xl bg-neutral-900 border border-neutral-800 transition-colors"
        >
          &larr; ホームへ
        </Link>
      </header>

      {loading ? (
        <div className="p-12 text-center text-neutral-500 text-xs font-bold">
          ステータスを確認中...
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-4 shadow-xs">
            <span className="text-sm font-black text-white">
              クラウド同期ステータス
            </span>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                <span className="text-[10px] font-bold text-neutral-500 block">総対局数</span>
                <span className="text-base font-black text-amber-300">
                  {gamesCount} 戦
                </span>
              </div>
              <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                <span className="text-[10px] font-bold text-neutral-500 block">総記録局数</span>
                <span className="text-base font-black text-cyan-300">
                  {roundsCount} 局
                </span>
              </div>
              <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                <span className="text-[10px] font-bold text-neutral-500 block">登録メンバー</span>
                <span className="text-base font-black text-neutral-200">
                  {membersCount} 名
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-between text-xs">
              <span className="font-bold text-neutral-400">Supabase 接続</span>
              <span className="font-black text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                正常稼働中
              </span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
