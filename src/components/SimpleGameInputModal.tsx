'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { RuleConfig } from '@/types/mahjong';
import { calculateGameSettlement } from '@/lib/mahjong/rules';
import { buildSimpleGamePayload, validateSimpleGameScores } from '@/lib/mahjong/simpleGame';

interface PlayerInfo {
  seat: number; // 1: 東, 2: 南, 3: 西, 4: 北
  memberId: string;
  playerName: string;
}

interface SimpleGameInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  ruleName: string;
  ruleConfig: RuleConfig;
  players: PlayerInfo[];
}

const SEAT_LABELS = ['東家 (起家)', '南家', '西家', '北家'];

export function SimpleGameInputModal({
  isOpen,
  onClose,
  groupId,
  ruleName,
  ruleConfig,
  players,
}: SimpleGameInputModalProps) {
  // 各プレイヤーの持ち点（初期値25,000点）
  const [scores, setScores] = useState<Record<number, number>>({
    1: 25000,
    2: 25000,
    3: 25000,
    4: 25000,
  });

  // 対局日時（デフォルト: 現在日時 YYYY-MM-DDTHH:mm）
  const [playedAt, setPlayedAt] = useState<string>(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const local = new Date(now.getTime() - offset);
    return local.toISOString().slice(0, 16);
  });

  const [saving, setSaving] = useState(false);
  const [savedResult, setSavedResult] = useState<{
    gameId: string;
    settlements: Array<{ seat: number; player: string; rank: number; score: number; point: number }>;
  } | null>(null);

  // 合計点計算
  const totalScore = useMemo(() => {
    return (scores[1] || 0) + (scores[2] || 0) + (scores[3] || 0) + (scores[4] || 0);
  }, [scores]);

  const isValidTotal = totalScore === 100000;
  const remainder = 100000 - totalScore;

  // リアルタイム精算プレビュー
  const settlementPreview = useMemo(() => {
    if (!isValidTotal) return null;
    const playerNames = players.map((p) => p.playerName);
    const scoreMap: Record<string, number> = {};
    players.forEach((p) => {
      scoreMap[p.playerName] = scores[p.seat] ?? 25000;
    });

    return calculateGameSettlement(playerNames, scoreMap, ruleConfig, 0);
  }, [isValidTotal, players, scores, ruleConfig]);

  if (!isOpen) return null;

  // スコア調整ハンドラ
  const updateScore = (seat: number, delta: number) => {
    setScores((prev) => ({
      ...prev,
      [seat]: (prev[seat] || 0) + delta,
    }));
  };

  const setScoreDirect = (seat: number, val: number) => {
    setScores((prev) => ({
      ...prev,
      [seat]: Number.isFinite(val) ? val : 0,
    }));
  };

  // 保存処理
  const handleSave = async () => {
    if (!isValidTotal) {
      alert('4人の合計点数が100,000点になるよう調整してください。');
      return;
    }

    try {
      setSaving(true);
      const gameId = crypto.randomUUID();
      const isoPlayedAt = new Date(playedAt).toISOString();

      const payload = buildSimpleGamePayload({
        gameId,
        groupId,
        playedAt: isoPlayedAt,
        ruleName,
        ruleConfig,
        players: players.map((p) => ({
          seat: p.seat,
          memberId: p.memberId,
          playerName: p.playerName,
          score: scores[p.seat] ?? 25000,
          wasGroupMember: 1,
        })),
      });

      // 1. games レコード作成
      const { error: gErr } = await (supabase.from('games') as any).insert(payload.game);
      if (gErr) throw new Error(gErr.message || JSON.stringify(gErr));

      // 2. game_participants レコード作成
      const { error: pErr } = await (supabase.from('game_participants') as any).insert(
        payload.participants
      );
      if (pErr) throw new Error(pErr.message || JSON.stringify(pErr));

      // 完了結果の表示
      const resList = payload.participants
        .map((p) => ({
          seat: p.seat,
          player: p.player_name_snapshot,
          rank: p.rank,
          score: p.final_score,
          point: p.point,
        }))
        .sort((a, b) => a.rank - b.rank);

      setSavedResult({
        gameId,
        settlements: resList,
      });
    } catch (e: any) {
      console.error('Simple game save error:', e);
      alert(`保存に失敗しました: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-neutral-900 border-t sm:border border-neutral-800 rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col gap-4 max-h-[95dvh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div>
            <h3 className="text-base font-black text-white">結果のみ入力（簡易スコア記録）</h3>
            <p className="text-xs text-neutral-400 font-bold mt-0.5">
              ルール: {ruleName}
            </p>
          </div>
          {!savedResult && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 text-neutral-400 hover:text-white text-sm font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* 完了画面 */}
        {savedResult ? (
          <div className="flex flex-col gap-4 py-2">
            <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-center">
              <span className="text-xs font-black text-emerald-400 block mb-1">
                記録完了
              </span>
              <p className="text-base font-black text-white">
                対局結果を正常に保存しました
              </p>
            </div>

            {/* 結果一覧テーブル */}
            <div className="flex flex-col gap-1.5 bg-neutral-950 p-3 rounded-xl border border-neutral-800">
              {savedResult.settlements.map((item) => (
                <div
                  key={item.seat}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-neutral-900/60 border border-neutral-800/80"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded flex items-center justify-center text-xs font-black ${
                        item.rank === 1
                          ? 'bg-amber-500 text-black'
                          : item.rank === 2
                          ? 'bg-neutral-300 text-black'
                          : item.rank === 3
                          ? 'bg-amber-800 text-white'
                          : 'bg-neutral-700 text-white'
                      }`}
                    >
                      {item.rank}
                    </span>
                    <span className="text-sm font-black text-white">{item.player}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-neutral-300">
                      {item.score.toLocaleString()}点
                    </span>
                    <span
                      className={`text-sm font-black w-16 text-right ${
                        item.point > 0
                          ? 'text-cyan-400'
                          : item.point < 0
                          ? 'text-rose-400'
                          : 'text-neutral-300'
                      }`}
                    >
                      {item.point > 0 ? `+${item.point.toFixed(1)}` : item.point.toFixed(1)}pt
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* 完了アクション導線 */}
            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/stats"
                className="h-12 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-white font-black text-sm flex items-center justify-center transition-colors shadow-xs"
              >
                成績集計を見る
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSavedResult(null);
                  onClose();
                }}
                className="h-12 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm transition-colors shadow-md"
              >
                完了（ホームへ戻る）
              </button>
            </div>
          </div>
        ) : (
          /* 入力フォーム画面 */
          <div className="flex flex-col gap-4">
            {/* 対局日時指定 */}
            <div className="flex items-center justify-between bg-neutral-950 p-2.5 rounded-xl border border-neutral-800">
              <label className="text-xs font-black text-neutral-300">対局日時</label>
              <input
                type="datetime-local"
                value={playedAt}
                onChange={(e) => setPlayedAt(e.target.value)}
                className="bg-neutral-900 border border-neutral-750 rounded-lg px-2 py-1 text-xs text-white font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 合計点数バリデーションインジケーター */}
            <div
              className={`p-3 rounded-xl border flex items-center justify-between font-black text-xs sm:text-sm ${
                isValidTotal
                  ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/60 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-current animate-pulse" />
                <span>合計: {totalScore.toLocaleString()}点</span>
              </div>
              <div>
                {isValidTotal ? (
                  <span className="font-black text-emerald-400">適正 (100,000点)</span>
                ) : remainder > 0 ? (
                  <span>残り: +{remainder.toLocaleString()}点</span>
                ) : (
                  <span>超過: {Math.abs(remainder).toLocaleString()}点</span>
                )}
              </div>
            </div>

            {/* プレイヤー4名のスコア入力カード */}
            <div className="flex flex-col gap-2.5">
              {players.map((p) => {
                const preview = settlementPreview?.find((s) => s.seat === p.seat);
                const currentScore = scores[p.seat] ?? 25000;

                return (
                  <div
                    key={p.seat}
                    className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl flex flex-col gap-2"
                  >
                    {/* プレイヤー名・席・暫定ptプレビュー */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                          {SEAT_LABELS[p.seat - 1]}
                        </span>
                        <span className="text-sm font-black text-white">{p.playerName}</span>
                      </div>
                      {preview && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-amber-400">
                            {preview.rank}位
                          </span>
                          <span
                            className={`text-xs font-black px-1.5 py-0.5 rounded bg-neutral-900 ${
                              preview.point > 0
                                ? 'text-cyan-400'
                                : preview.point < 0
                                ? 'text-rose-400'
                                : 'text-neutral-300'
                            }`}
                          >
                            {preview.point > 0 ? `+${preview.point.toFixed(1)}` : preview.point.toFixed(1)}pt
                          </span>
                        </div>
                      )}
                    </div>

                    {/* スコア数値入力 + クイック調整ボタン */}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step={100}
                        value={currentScore}
                        onChange={(e) => setScoreDirect(p.seat, parseInt(e.target.value, 10) || 0)}
                        className="w-28 sm:w-32 h-10 bg-neutral-900 border border-neutral-750 rounded-lg px-2 text-right text-base font-mono font-black text-white focus:outline-none focus:border-amber-500"
                      />
                      <div className="flex-1 flex gap-1 items-center justify-end">
                        <button
                          type="button"
                          onClick={() => updateScore(p.seat, 1000)}
                          className="h-10 px-2 sm:px-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-[11px] font-black text-neutral-200"
                        >
                          +1k
                        </button>
                        <button
                          type="button"
                          onClick={() => updateScore(p.seat, 10000)}
                          className="h-10 px-2 sm:px-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-[11px] font-black text-neutral-200"
                        >
                          +10k
                        </button>
                        <button
                          type="button"
                          onClick={() => updateScore(p.seat, -1000)}
                          className="h-10 px-2 sm:px-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-[11px] font-black text-neutral-200"
                        >
                          -1k
                        </button>
                        <button
                          type="button"
                          onClick={() => updateScore(p.seat, -10000)}
                          className="h-10 px-2 sm:px-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-[11px] font-black text-neutral-200"
                        >
                          -10k
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* アクションボタン */}
            <div className="flex gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-12 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={!isValidTotal || saving}
                onClick={handleSave}
                className={`flex-2 h-12 rounded-xl text-xs font-black shadow-md transition-all ${
                  isValidTotal && !saving
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-[0.98]'
                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                }`}
              >
                {saving ? '保存中...' : '結果を記録して確定'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
