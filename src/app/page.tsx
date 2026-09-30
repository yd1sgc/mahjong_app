/**
 * ホーム画面：対局開始・中断再開・成績・管理導線
 * mahjong_personal 準拠：中断対局の自動検知バナー・目的別大ボタン・絵文字なし
 *
 * グループ未選択初期化・フリー対局・ルール自動連動・メンバー絞り込み・重複除外対応
 * データ取得・対局作成・簡易保存は useHome に委譲する
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RotateCw, GripVertical } from 'lucide-react';
import { RuleTemplateRow } from '@/types/database';
import { SimpleGameInputModal } from '@/components/SimpleGameInputModal';
import { RuleDetailModal } from '@/components/RuleDetailModal';
import { RuleConfig } from '@/types/mahjong';
import { useHome } from '@/hooks/useHome';

export default function HomePage() {
  const router = useRouter();
  const {
    games,
    members,
    groups,
    rules,
    selectedGroupId,
    selectedRuleId,
    selectedMembers,
    setSelectedRuleId,
    setSelectedMembers,
    handleGroupChange,
    resetSetup,
    rotateSeats,
    getAvailableMembersForSeat,
    isReadyToCreate,
    simpleGameGroupId,
    loadData,
    saveCurrentSetup,
    createGame,
    persistSimpleGame,
  } = useHome();

  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [showSimpleModal, setShowSimpleModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [gamePin, setGamePin] = useState('1234');
  const [detailModalRule, setDetailModalRule] = useState<RuleTemplateRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);

  const [swapSourceIdx, setSwapSourceIdx] = useState<number | null>(null);
  const [dragSourceIdx, setDragSourceIdx] = useState<number | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const pointerStartPosRef = React.useRef<{ x: number; y: number } | null>(null);

  const swapSeats = (idxA: number, idxB: number) => {
    if (idxA === idxB) return;
    setSelectedMembers((prev) => {
      const next = [...prev];
      const tmp = next[idxA];
      next[idxA] = next[idxB];
      next[idxB] = tmp;
      return next;
    });
  };

  const handleSeatTap = (idx: number) => {
    if (swapSourceIdx === null) {
      setSwapSourceIdx(idx);
    } else if (swapSourceIdx === idx) {
      setSwapSourceIdx(null);
    } else {
      swapSeats(swapSourceIdx, idx);
      setSwapSourceIdx(null);
    }
  };

  const handlePointerDown = (e: React.PointerEvent, idx: number) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
    setDragSourceIdx(idx);
    setDropTargetIdx(null);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragSourceIdx === null) return;
    const elem = document.elementFromPoint(e.clientX, e.clientY);
    const seatElem = elem?.closest('[data-seat-idx]');
    if (seatElem) {
      const targetIdx = Number(seatElem.getAttribute('data-seat-idx'));
      if (!isNaN(targetIdx) && targetIdx !== dragSourceIdx) {
        setDropTargetIdx(targetIdx);
        return;
      }
    }
    setDropTargetIdx(null);
  };

  const handlePointerUp = (e: React.PointerEvent, idx: number) => {
    if (dragSourceIdx === null) return;
    const startPos = pointerStartPosRef.current;
    const isTap =
      startPos &&
      Math.hypot(e.clientX - startPos.x, e.clientY - startPos.y) < 6;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    if (isTap) {
      handleSeatTap(idx);
    } else {
      const elem = document.elementFromPoint(e.clientX, e.clientY);
      const seatElem = elem?.closest('[data-seat-idx]');
      if (seatElem) {
        const targetIdx = Number(seatElem.getAttribute('data-seat-idx'));
        if (!isNaN(targetIdx) && targetIdx !== dragSourceIdx) {
          swapSeats(dragSourceIdx, targetIdx);
          setSwapSourceIdx(null);
        }
      }
    }

    setDragSourceIdx(null);
    setDropTargetIdx(null);
    pointerStartPosRef.current = null;
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setDragSourceIdx(null);
    setDropTargetIdx(null);
    pointerStartPosRef.current = null;
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (typeof window !== 'undefined' && 'caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update();
        }
      }
      await loadData();
      setRefreshed(true);
      setTimeout(() => setRefreshed(false), 1500);
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const activeGame = games.find((g) => g.status === 'in_progress');

  const validateSelectedPlayers = (): boolean => {
    if (!selectedGroupId) {
      alert('グループを選択してください');
      return false;
    }
    const validMembers = selectedMembers.filter(Boolean);
    if (validMembers.length !== 4) {
      alert('4名のプレイヤーを選択してください');
      return false;
    }
    if (new Set(validMembers).size !== 4) {
      alert('プレイヤーが重複しています。異なる4名を選択してください');
      return false;
    }
    return true;
  };

  const handleStartSimpleGame = () => {
    if (!validateSelectedPlayers()) return;
    saveCurrentSetup();
    setShowNewGameModal(false);
    setShowSimpleModal(true);
  };

  const handleCreateGame = async () => {
    if (!validateSelectedPlayers()) return;

    const pin = gamePin.trim();
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      alert('引き継ぎ用の4桁PIN番号（数字4文字）を入力してください');
      return;
    }

    try {
      setCreating(true);
      const gameId = await createGame(pin);
      router.push(`/game?id=${gameId}`);
    } catch (e: unknown) {
      console.error(e);
      const errMsg = e instanceof Error ? e.message : String(e);
      alert(`対局作成に失敗しました: ${errMsg}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="w-full min-h-screen bg-black text-white max-w-lg mx-auto px-4 py-6 flex flex-col gap-6">
      <header className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          麻雀スコア管理
        </h1>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          title="キャッシュ・データを最新化"
          className="h-9 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-850 active:scale-[0.98] border border-neutral-800 text-neutral-300 hover:text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs shrink-0"
        >
          <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-white' : ''}`} />
          <span>{refreshing ? '更新中' : refreshed ? '完了' : '更新'}</span>
        </button>
      </header>

      {activeGame && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border-2 border-amber-500/60 shadow-lg flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black px-2 py-0.5 rounded bg-amber-500 text-black">
              進行中の対局
            </span>
            <span className="text-xs text-neutral-300 font-bold">
              {activeGame.played_at?.slice(5, 16).replace('T', ' ')}
            </span>
          </div>
          <p className="text-sm font-black text-amber-200">
            {activeGame.rule_name_snapshot} の対局が進行中です。再開しますか？
          </p>
          <div className="flex gap-2 pt-1">
            <Link
              href={`/game?id=${activeGame.game_id}`}
              className="flex-1 h-12 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-black font-black text-sm shadow-md transition-all flex items-center justify-center"
            >
              対局を再開する
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            setShowNewGameModal(true);
          }}
          className="h-16 sm:h-20 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white font-black text-lg sm:text-xl shadow-lg border border-rose-500/50 transition-all flex items-center justify-center touch-manipulation"
        >
          対局を始める
        </button>

        <Link
          href="/stats"
          className="h-14 sm:h-16 rounded-xl bg-neutral-900 hover:bg-neutral-850 active:scale-[0.98] border border-neutral-800 hover:border-neutral-700 text-neutral-100 font-black text-base transition-all flex items-center justify-center shadow-xs"
        >
          成績を見る
        </Link>

        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="/manage/rules"
            className="h-14 rounded-xl bg-neutral-900 hover:bg-neutral-850 active:scale-[0.98] border border-neutral-800 hover:border-neutral-700 text-neutral-200 font-black text-sm transition-all flex items-center justify-center shadow-xs"
          >
            ルール管理
          </Link>

          <Link
            href="/manage/groups"
            className="h-14 rounded-xl bg-neutral-900 hover:bg-neutral-850 active:scale-[0.98] border border-neutral-800 hover:border-neutral-700 text-neutral-200 font-black text-sm transition-all flex items-center justify-center shadow-xs"
          >
            グループ・メンバー
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="/manage/system"
            className="h-14 rounded-xl bg-neutral-900 hover:bg-neutral-850 active:scale-[0.98] border border-neutral-800 hover:border-neutral-700 text-neutral-200 font-black text-sm transition-all flex items-center justify-center shadow-xs"
          >
            データ管理
          </Link>

          <Link
            href="/aggregate"
            className="h-14 rounded-xl bg-neutral-900 hover:bg-neutral-850 active:scale-[0.98] border border-neutral-800 hover:border-neutral-700 text-neutral-200 font-black text-sm transition-all flex items-center justify-center shadow-xs"
          >
            合計集計
          </Link>
        </div>
      </div>

      {showNewGameModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-neutral-900 border-t sm:border border-neutral-800 rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col gap-4 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white">新規対局の開始</h3>
                {selectedGroupId && selectedMembers.filter(Boolean).length === 4 && (
                  <span className="text-[10px] text-amber-400 font-bold block mt-0.5">
                    直前の対局設定を自動反映中
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedGroupId && (
                  <button
                    type="button"
                    onClick={() => {
                      resetSetup();
                      setSwapSourceIdx(null);
                    }}
                    className="text-[11px] font-bold text-neutral-400 hover:text-white px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-750 transition-colors"
                  >
                    リセット
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowNewGameModal(false);
                    setSwapSourceIdx(null);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 text-neutral-400 hover:text-white text-sm font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-neutral-300 block mb-1.5">
                対局グループ
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => handleGroupChange(e.target.value)}
                className={`w-full h-11 bg-neutral-950 border rounded-xl px-3 text-sm font-bold focus:outline-none focus:border-amber-500 ${
                  !selectedGroupId
                    ? 'border-amber-500/60 text-neutral-400'
                    : 'border-neutral-800 text-white'
                }`}
              >
                <option value="">グループを選択してください</option>
                {groups
                  .filter(
                    (g) => g.display_id !== 'free' && g.group_name !== 'フリー対局'
                  )
                  .map((g) => (
                    <option key={g.group_id} value={g.group_id}>
                      {g.group_name}
                    </option>
                  ))}
                <option value="free">フリー対局</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-black text-neutral-300 block mb-1.5">
                対局ルール
              </label>
              <select
                value={selectedRuleId}
                disabled={!selectedGroupId}
                onChange={(e) => setSelectedRuleId(e.target.value)}
                className={`w-full h-11 bg-neutral-950 border rounded-xl px-3 text-sm font-bold focus:outline-none focus:border-amber-500 ${
                  !selectedGroupId
                    ? 'border-neutral-850 text-neutral-600 cursor-not-allowed'
                    : 'border-neutral-800 text-white'
                }`}
              >
                {!selectedGroupId && <option value="">先にグループを選択してください</option>}
                {rules.map((r) => (
                  <option key={r.rule_id} value={r.rule_id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {selectedRuleId && (
                <button
                  type="button"
                  onClick={() => {
                    const r = rules.find((item) => item.rule_id === selectedRuleId);
                    if (r) setDetailModalRule(r);
                  }}
                  className="mt-1.5 text-[11px] font-bold text-amber-400 hover:text-amber-300 underline flex items-center gap-1"
                >
                  ルール詳細を確認 &rarr;
                </button>
              )}
            </div>

            <div>
              <label className="text-xs font-black text-neutral-300 block mb-1.5">
                引き継ぎ用4桁PIN番号
              </label>
              <input
                id="game-pin"
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                maxLength={4}
                value={gamePin}
                onChange={(e) => setGamePin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="4桁の数字 (例: 1234)"
                className="w-full h-11 bg-neutral-950 border border-neutral-800 rounded-xl px-3 text-sm text-white font-mono font-bold tracking-widest focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-black text-neutral-300">
                  対局者
                </label>
                {selectedMembers.filter(Boolean).length === 4 && (
                  <button
                    type="button"
                    onClick={rotateSeats}
                    className="text-[10px] text-amber-400 hover:text-amber-300 font-bold underline"
                    title="4名の座順を時計回りに1席ずらします"
                  >
                    ローテーション
                  </button>
                )}
              </div>

              {!selectedGroupId ? (
                <div className="p-4 bg-neutral-950/60 rounded-xl border border-neutral-850 text-center text-xs text-neutral-500 font-bold">
                  対局グループを選択すると、メンバー選択肢が表示されます
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {['東家 (起家)', '南家', '西家', '北家'].map((seatLabel, idx) => {
                    const availableMembers = getAvailableMembersForSeat(idx);
                    const isDragging = dragSourceIdx === idx;
                    const isDropTarget = dropTargetIdx === idx;
                    const isSelected = swapSourceIdx === idx;

                    return (
                      <div
                        key={idx}
                        data-seat-idx={idx}
                        className={`flex flex-col gap-1.5 p-2 rounded-xl border transition-all ${
                          isDragging
                            ? 'opacity-40 border-amber-500 scale-[0.98]'
                            : isDropTarget
                            ? 'border-dashed border-amber-400 bg-amber-500/10 scale-[1.02]'
                            : isSelected
                            ? 'border-amber-500 ring-2 ring-amber-500/40 bg-neutral-900'
                            : 'border-neutral-800 bg-neutral-950/60'
                        }`}
                      >
                        <div
                          onPointerDown={(e) => handlePointerDown(e, idx)}
                          onPointerMove={handlePointerMove}
                          onPointerUp={(e) => handlePointerUp(e, idx)}
                          onPointerCancel={handlePointerCancel}
                          className="h-8 flex items-center justify-between px-1 rounded-lg cursor-grab active:cursor-grabbing select-none touch-none hover:bg-neutral-850/60 transition-colors"
                        >
                          <div className="flex items-center gap-1.5">
                            <GripVertical
                              className={`w-3.5 h-3.5 ${
                                isSelected ? 'text-amber-400' : 'text-neutral-500'
                              }`}
                            />
                            <span
                              className={`text-xs font-bold ${
                                isSelected ? 'text-amber-300' : 'text-neutral-300'
                              }`}
                            >
                              {seatLabel}
                            </span>
                          </div>
                          {isSelected && (
                            <span className="text-[10px] text-amber-400 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded">
                              入替元
                            </span>
                          )}
                        </div>

                        <select
                          value={selectedMembers[idx]}
                          onChange={(e) => {
                            const next = [...selectedMembers];
                            next[idx] = e.target.value;
                            setSelectedMembers(next);
                            setSwapSourceIdx(null);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className={`h-11 bg-neutral-950 border rounded-lg px-2 text-xs font-bold text-white focus:outline-none focus:border-amber-500 ${
                            selectedMembers[idx]
                              ? 'border-neutral-700 text-white'
                              : 'border-neutral-850 text-neutral-400'
                          }`}
                        >
                          <option value="">選択してください</option>
                          {availableMembers.map((m) => (
                            <option key={m.member_id} value={m.member_id}>
                              {m.member_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-neutral-800">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!isReadyToCreate}
                  onClick={handleStartSimpleGame}
                  className={`flex-1 h-12 rounded-xl text-xs font-black transition-all shadow-xs border ${
                    isReadyToCreate
                      ? 'bg-neutral-800 hover:bg-neutral-750 active:scale-[0.98] border-amber-500/60 text-amber-300'
                      : 'bg-neutral-950 text-neutral-600 border-neutral-850 cursor-not-allowed'
                  }`}
                >
                  結果のみ入力
                </button>
                <button
                  type="button"
                  disabled={creating || !isReadyToCreate}
                  onClick={handleCreateGame}
                  className={`flex-2 h-12 rounded-xl text-xs font-black shadow-md transition-all ${
                    isReadyToCreate && !creating
                      ? 'bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white'
                      : 'bg-neutral-800 text-neutral-600 cursor-not-allowed border border-neutral-750'
                  }`}
                >
                  {creating ? '作成中...' : '対局を作成して開始'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowNewGameModal(false)}
                className="w-full h-10 rounded-xl bg-neutral-950 hover:bg-neutral-850 text-neutral-400 text-xs font-bold transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      <SimpleGameInputModal
        isOpen={showSimpleModal}
        onClose={() => setShowSimpleModal(false)}
        groupId={simpleGameGroupId}
        ruleName={rules.find((r) => r.rule_id === selectedRuleId)?.name || '標準ルール'}
        ruleConfig={((rules.find((r) => r.rule_id === selectedRuleId)?.config_json as unknown as RuleConfig) || {}) as RuleConfig}
        players={selectedMembers.map((mId, idx) => {
          const mem = members.find((m) => m.member_id === mId);
          return {
            seat: idx + 1,
            memberId: mId,
            playerName: mem?.member_name || `P${idx + 1}`,
          };
        })}
        onPersist={persistSimpleGame}
      />

      {detailModalRule && (
        <RuleDetailModal
          ruleName={detailModalRule.name}
          config={detailModalRule.config_json as unknown as RuleConfig}
          isOfficial={detailModalRule.kind === 'official'}
          onClose={() => setDetailModalRule(null)}
        />
      )}
    </main>
  );
}
