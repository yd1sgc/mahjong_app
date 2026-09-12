/**
 * 対局入力・リアルタイム共有画面（静的SPA完全対応版: /game?id=xxx）
 * docs/DETAILED_DESIGN.md 準拠
 */

'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGame } from '@/hooks/useGame';
import { ScoreBoard } from '@/components/ScoreBoard';
import { ActionPanel } from '@/components/ActionPanel';
import { RoundInputModal } from '@/components/RoundInputModal';
import { PinTransferModal } from '@/components/PinTransferModal';
import { Toast } from '@/components/Toast';
import { WinType } from '@/types/mahjong';

function GameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameId = searchParams.get('id') || '';

  const {
    loading,
    error,
    game,
    players,
    ruleConfig,
    gameState,
    settlement,
    isRecorder,
    gameEndReason,
    draft,
    updateDraft,
    transferRecorder,
    toggleFuro,
    declareRiichi,
    commitRound,
    undoRound,
    finishGame,
    abortGame,
  } = useGame(gameId);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalWinType, setModalWinType] = useState<WinType>('ron');
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    onRetry?: () => void;
  } | null>(null);

  const handleOpenWinModal = (type: 'ron' | 'tsumo') => {
    setModalWinType(type);
    setModalOpen(true);
  };

  const handleOpenRyukyokuModal = () => {
    setModalWinType('ryukyoku');
    setModalOpen(true);
  };

  const handleOpenChomboModal = () => {
    setModalWinType('chombo');
    setModalOpen(true);
  };

  const handleCommitRoundWithToast = async (...args: Parameters<typeof commitRound>) => {
    const ok = await commitRound(...args);
    if (ok) {
      setToast({ type: 'success', message: '局結果を記録しました' });
    } else {
      setToast({
        type: 'error',
        message: '局結果の記録に失敗しました',
        onRetry: () => handleCommitRoundWithToast(...args),
      });
    }
    return ok;
  };

  const handleUndoWithToast = async () => {
    const ok = await undoRound();
    if (ok) {
      setToast({ type: 'info', message: '直前の局を巻き戻しました' });
    } else {
      setToast({ type: 'error', message: 'Undoに失敗しました' });
    }
  };

  const handleConfirmFinish = async () => {
    try {
      setSubmitting(true);
      const ok = await finishGame();
      if (ok) {
        setSettleModalOpen(false);
        setToast({ type: 'success', message: '対局を精算・確定しました' });
      } else {
        setToast({
          type: 'error',
          message: '対局の終了処理に失敗しました',
          onRetry: handleConfirmFinish,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmAbort = async () => {
    const ok = window.confirm(
      '【警告】この対局データを完全に削除しますか？\n入力したすべての局記録が消去され、戦績には残りません。'
    );
    if (!ok) return;

    try {
      setSubmitting(true);
      const res = await abortGame();
      if (res) {
        router.push('/');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!gameId) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-center">
        <p className="text-red-400 font-bold text-base mb-2">
          対局ID（?id=xxx）が指定されていません
        </p>
        <Link
          href="/"
          className="text-xs text-neutral-400 hover:text-white underline"
        >
          ホーム画面へ戻る
        </Link>
      </div>
    );
  }

  if (loading && !gameState) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-neutral-400 text-sm mt-3 font-bold">対局データを読込中...</p>
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-center">
        <p className="text-red-400 font-bold text-base mb-2">{error}</p>
        <Link
          href="/"
          className="text-xs text-neutral-400 hover:text-white underline"
        >
          ホーム画面へ戻る
        </Link>
      </div>
    );
  }

  return (
    <main className="w-full h-[100dvh] max-h-[100dvh] bg-black text-white flex flex-col justify-between max-w-xl mx-auto p-2.5 sm:p-3 select-none touch-manipulation overflow-hidden">
      {/* 上部ヘッダー */}
      <header className="flex items-center justify-between py-1.5 border-b border-neutral-800 shrink-0">
        <Link
          href="/"
          className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 font-bold py-1 px-1.5 rounded-lg hover:bg-neutral-900 transition-colors"
        >
          &larr; 中断
        </Link>
        <div className="text-center">
          <h1 className="text-sm font-black text-neutral-100">
            {game?.rule_name_snapshot || '対局'}
          </h1>
          <span className="text-[10px] text-neutral-500 font-semibold">
            {game?.played_at?.slice(0, 16) || ''}
          </span>
        </div>

        {/* ヘッダー右上：記録係かつ未完了なら「精算・終了」ボタン */}
        {isRecorder && game?.status !== 'completed' ? (
          <button
            type="button"
            onClick={() => setSettleModalOpen(true)}
            className="text-xs font-black px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-500/40 transition-colors shadow-sm"
          >
            精算・終了
          </button>
        ) : (
          <span className="text-[11px] font-mono font-bold text-neutral-500 uppercase">
            ID: {gameId.slice(0, 6)}
          </span>
        )}
      </header>

      {/* 終局・サドンデス・飛び通知バナー */}
      {gameEndReason && game?.status !== 'completed' && (
        <div className="my-1 p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-between px-3 shrink-0">
          <span className="font-black text-xs">[終局条件] {gameEndReason}</span>
          {isRecorder && (
            <button
              type="button"
              onClick={() => setSettleModalOpen(true)}
              className="text-xs font-black px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black shadow transition-all"
            >
              精算へ進む &rarr;
            </button>
          )}
        </div>
      )}

      {/* スコアボード (中央メイン・4行リスト) */}
      <div className="flex-1 flex flex-col justify-center my-auto overflow-hidden">
        <ScoreBoard
          players={players}
          gameState={gameState}
          onRiichiClick={declareRiichi}
          onFuroClick={toggleFuro}
          isRecorder={isRecorder && game?.status !== 'completed'}
        />
      </div>

      {/* 下部パネル（対局完了時と進行中で分岐） */}
      <footer className="mt-2">
        {game?.status === 'completed' ? (
          <div className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 flex flex-col gap-2.5 shadow-md text-center">
            <div className="text-xs font-bold text-emerald-400">
              対局終了・成績確定済み
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/"
                className="h-11 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-white font-bold text-xs flex items-center justify-center border border-neutral-700 transition-colors"
              >
                ホームへ戻る
              </Link>
              <Link
                href="/stats"
                className="h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center justify-center transition-colors shadow"
              >
                成績集計を見る &rarr;
              </Link>
            </div>
          </div>
        ) : (
          <ActionPanel
            isRecorder={isRecorder}
            passcode={game?.passcode || '0000'}
            onOpenWinModal={handleOpenWinModal}
            onOpenRyukyokuModal={handleOpenRyukyokuModal}
            onOpenChomboModal={handleOpenChomboModal}
            onUndoClick={handleUndoWithToast}
            onOpenTransferModal={() => setPinModalOpen(true)}
            canUndo={(gameState?.roundHistory.length ?? 0) > 0}
          />
        )}
      </footer>

      {/* 入力モーダル */}
      <RoundInputModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        players={players}
        roundIdx={gameState?.roundIdx ?? 0}
        honba={gameState?.honba ?? 0}
        riichiSticks={gameState?.riichiStick ?? 0}
        ruleConfig={ruleConfig}
        draft={draft}
        updateDraft={updateDraft}
        onCommit={handleCommitRoundWithToast}
        initialWinType={modalWinType}
        riichiDeclared={gameState?.riichiDeclared ?? []}
      />

      {/* トースト通知 */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onRetry={toast.onRetry}
          onClose={() => setToast(null)}
        />
      )}

      {/* 4桁PIN引き継ぎモーダル */}
      <PinTransferModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onTransfer={transferRecorder}
      />

      {/* 対局終了・精算確認モーダル */}
      {settleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-neutral-900 border border-neutral-700 w-full max-w-md rounded-2xl p-4 shadow-2xl flex flex-col gap-3 text-white">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <h2 className="text-base font-black text-white">
                対局終了・精算確認
              </h2>
              <button
                type="button"
                onClick={() => setSettleModalOpen(false)}
                className="text-neutral-400 hover:text-white text-lg font-bold leading-none p-1"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              現在の素点およびウマオカ計算結果です。確定すると戦績（/stats）に公式反映されます。
            </p>

            {/* 成績プレビューリスト */}
            <div className="flex flex-col gap-1.5 bg-neutral-950 p-2.5 rounded-xl border border-neutral-800">
              {settlement?.map((s) => (
                <div
                  key={s.player}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-neutral-900/60 border border-neutral-800/80 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-[11px] ${
                        s.rank === 1
                          ? 'bg-amber-400 text-black'
                          : s.rank === 2
                          ? 'bg-neutral-300 text-black'
                          : s.rank === 3
                          ? 'bg-amber-800 text-amber-100'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {s.rank}
                    </span>
                    <span className="font-black text-neutral-200">
                      {s.player}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-neutral-400 font-mono">
                      {s.finalScore.toLocaleString()}点
                    </span>
                    <span
                      className={`font-black font-mono w-14 text-right ${
                        s.point > 0
                          ? 'text-cyan-400'
                          : s.point < 0
                          ? 'text-rose-400'
                          : 'text-neutral-400'
                      }`}
                    >
                      {s.point > 0 ? `+${s.point.toFixed(1)}` : s.point.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}

              <div className="text-[11px] font-mono text-neutral-500 text-right pt-1 border-t border-neutral-800">
                合計pt検算: {settlement?.reduce((acc, r) => acc + r.point, 0).toFixed(1)}pt (ゼロ和)
              </div>
            </div>

            {/* ボタン群 */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmFinish}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-black text-sm shadow transition-all flex items-center justify-center disabled:opacity-50"
              >
                {submitting ? '保存中...' : '成績を確定して保存'}
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => setSettleModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-300 font-bold text-xs transition-colors"
              >
                対局に戻る
              </button>

              <div className="pt-2 border-t border-neutral-800/80 text-center">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmAbort}
                  className="text-xs text-rose-400 hover:text-rose-300 hover:underline py-1"
                >
                  この対局を破棄（データを残さず削除）
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function GamePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center text-neutral-500 text-xs">
          読込中...
        </div>
      }
    >
      <GameContent />
    </Suspense>
  );
}
