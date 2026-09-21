/**
 * 対局入力・リアルタイム共有画面（静的SPA完全対応版: /game?id=xxx）
 * docs/DETAILED_DESIGN.md 準拠
 */

'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGame } from '@/hooks/useGame';
import { useWakeLock } from '@/hooks/useWakeLock';
import { ScoreBoard } from '@/components/ScoreBoard';
import { ActionPanel } from '@/components/ActionPanel';
import { RoundInputModal } from '@/components/RoundInputModal';
import { RoundEditModal } from '@/components/RoundEditModal';
import { PinTransferModal } from '@/components/PinTransferModal';
import { Toast } from '@/components/Toast';
import { RuleDetailModal } from '@/components/RuleDetailModal';
import { WinType } from '@/types/mahjong';

function GameContent() {
  useWakeLock();
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
    undoLastAction,
    updateRoundAndRecalculate,
    canUndo,
    hasIntraRoundAction,
    finishGame,
    abortGame,
  } = useGame(gameId);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalWinType, setModalWinType] = useState<WinType>('ron');
  const [roundEditModalOpen, setRoundEditModalOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [ruleDetailOpen, setRuleDetailOpen] = useState(false);
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
    const result = await undoLastAction();
    if (!result) {
      setToast({ type: 'error', message: '取り消しに失敗しました' });
      return;
    }
    if (result.type === 'furo') {
      setToast({ type: 'info', message: `${result.player} の副露を取り消しました` });
    } else if (result.type === 'riichi') {
      setToast({ type: 'info', message: `${result.player} の立直を取り消しました` });
    } else if (result.type === 'round') {
      setToast({ type: 'info', message: `${result.kyokuName} の記録を取り消しました` });
    } else if (result.type === 'cancelled') {
      // ユーザーによる確認ダイアログのキャンセル
      return;
    } else if (result.type === 'error') {
      setToast({ type: 'error', message: result.message || '取り消しに失敗しました' });
    }
  };

  const handleUpdateRoundWithToast = async (...args: Parameters<typeof updateRoundAndRecalculate>) => {
    const ok = await updateRoundAndRecalculate(...args);
    if (ok) {
      setToast({ type: 'success', message: '局データを修正し、全体を再計算しました' });
    } else {
      setToast({
        type: 'error',
        message: '局データの修正に失敗しました',
        onRetry: () => handleUpdateRoundWithToast(...args),
      });
    }
    return ok;
  };

  const handleConfirmFinish = async () => {
    try {
      setSubmitting(true);
      const ok = await finishGame();
      if (ok) {
        setSettleModalOpen(false);
        router.push('/');
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
      } else {
        setToast({
          type: 'error',
          message: '対局の破棄に失敗しました',
          onRetry: handleConfirmAbort,
        });
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
    <main className="w-full h-[100dvh] max-h-[100dvh] bg-black text-white flex flex-col justify-between max-w-xl mx-auto p-2.5 sm:p-3 select-none touch-manipulation overflow-hidden md:max-w-5xl md:h-auto md:min-h-[100dvh] md:max-h-none md:justify-start md:p-6 md:overflow-y-auto">
      {/* 上部ヘッダー */}
      <header className="flex items-center justify-between py-1.5 border-b border-neutral-800 shrink-0 md:pb-3 md:mb-4">
        <Link
          href="/"
          className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 font-bold py-1 px-1.5 rounded-lg hover:bg-neutral-900 transition-colors"
        >
          &larr; 中断
        </Link>
        <div className="text-center">
          <button
            type="button"
            onClick={() => setRuleDetailOpen(true)}
            className="flex items-center gap-1 mx-auto hover:opacity-80 transition-opacity"
          >
            <h1 className="text-sm font-black text-neutral-100 md:text-base">
              {game?.rule_name_snapshot || '対局'}
            </h1>
            <span className="text-[10px] font-bold text-neutral-300 bg-neutral-850 hover:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700">
              詳細
            </span>
          </button>
          <span className="text-[10px] text-neutral-500 font-semibold block">
            {game?.played_at?.slice(0, 16) || ''}
          </span>
        </div>

        {/* ヘッダー右上：記録係かつ未完了なら「精算・終了」ボタン */}
        {isRecorder && game?.status !== 'completed' ? (
          <button
            type="button"
            onClick={() => setSettleModalOpen(true)}
            className="text-xs font-bold px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-600 transition-colors shadow-sm"
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
        <div className="my-1 p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-between px-3 shrink-0 md:mb-4">
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

      {/* 対局メインコンテンツ (モバイル: 縦並び1画面 / PC: 左右2カラム) */}
      <div className="flex-1 flex flex-col justify-between overflow-hidden md:flex-row md:items-start md:gap-8 md:overflow-visible">
        {/* 左カラム: スコアボード (中央メイン・4行リスト) */}
        <div className="flex-1 flex flex-col justify-center my-auto overflow-hidden md:my-0 md:overflow-visible md:w-[60%]">
          <ScoreBoard
            players={players}
            gameState={gameState}
            ruleConfig={ruleConfig}
            onRiichiClick={declareRiichi}
            onFuroClick={toggleFuro}
            isRecorder={isRecorder && game?.status !== 'completed'}
          />
        </div>

        {/* 右カラム: 下部パネル（対局完了時と進行中で分岐） */}
        <footer className="mt-2 shrink-0 md:mt-0 md:w-[40%] md:sticky md:top-6">
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
              onOpenRoundEditModal={() => setRoundEditModalOpen(true)}
              onUndoClick={handleUndoWithToast}
              onOpenTransferModal={() => setPinModalOpen(true)}
              canUndo={canUndo}
              hasIntraRoundAction={hasIntraRoundAction}
            />
          )}
        </footer>
      </div>

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

      {/* 局修正モーダル */}
      <RoundEditModal
        isOpen={roundEditModalOpen}
        onClose={() => setRoundEditModalOpen(false)}
        players={players}
        ruleConfig={ruleConfig}
        roundHistory={gameState?.roundHistory ?? []}
        onSave={handleUpdateRoundWithToast}
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
      {settleModalOpen && (() => {
        const totalScore = settlement?.reduce((acc, r) => acc + r.finalScore, 0) ?? 0;
        const totalPt = settlement?.reduce((acc, r) => acc + r.point, 0) ?? 0;
        const initScore = Number(ruleConfig?.basic?.init_score ?? ruleConfig?.init_score ?? 25000);
        const expectedTotalScore = initScore * (players.length || 4);
        const isScoreMismatch = totalScore !== expectedTotalScore;
        const isPtMismatch = Math.abs(totalPt) > 0.05;
        const hasMismatch = isScoreMismatch || isPtMismatch;

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
            <div className="bg-neutral-900 border border-neutral-700 w-full max-w-md rounded-2xl p-4 shadow-2xl flex flex-col gap-3 text-white">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <h2 className="text-sm font-black text-white">
                  対局終了・精算
                </h2>
                <button
                  type="button"
                  onClick={() => setSettleModalOpen(false)}
                  className="text-neutral-400 hover:text-white text-lg font-bold leading-none p-1"
                >
                  &times;
                </button>
              </div>

              {/* 表頭ヘッダー */}
              <div className="flex items-center justify-between px-3 text-[11px] font-bold text-neutral-500 font-sans">
                <span>順位 / プレイヤー</span>
                <div className="flex items-center gap-4 font-mono text-right">
                  <span className="w-24 text-right">素点</span>
                  <span className="w-16 text-right">ポイント</span>
                </div>
              </div>

              {/* 成績プレビューリスト */}
              <div className="flex flex-col gap-1.5">
                {settlement?.map((s) => (
                  <div
                    key={s.player}
                    className={`flex items-center justify-between py-2.5 px-3 rounded-xl bg-neutral-950 border ${
                      s.rank === 1 ? 'border-neutral-700 shadow-sm' : 'border-neutral-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                          s.rank === 1
                            ? 'bg-white text-black'
                            : s.rank === 2
                            ? 'bg-neutral-800 text-neutral-300'
                            : s.rank === 3
                            ? 'bg-neutral-800 text-neutral-400'
                            : 'bg-neutral-800 text-neutral-500'
                        }`}
                      >
                        {s.rank}
                      </span>
                      <span className="font-black text-base text-white truncate max-w-[110px] sm:max-w-[140px]">
                        {s.player}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 font-mono text-right">
                      {/* 素点（点棒照合用・大フォント白太字） */}
                      <span
                        className={`w-24 font-black text-2xl tracking-tight leading-none ${
                          s.finalScore < 0 ? 'text-rose-400' : 'text-white'
                        }`}
                      >
                        {s.finalScore.toLocaleString()}
                      </span>

                      {/* ポイント（計算結果） */}
                      <span
                        className={`w-16 text-base font-bold leading-none ${
                          s.point > 0
                            ? 'text-amber-300'
                            : s.point < 0
                            ? 'text-neutral-400'
                            : 'text-neutral-500'
                        }`}
                      >
                        {s.point > 0 ? `+${s.point.toFixed(1)}` : s.point.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 検算フッター（不一致時は警告表示） */}
              <div
                className={`bg-neutral-950 border rounded-xl p-2.5 px-3 flex flex-col gap-1 text-xs font-mono transition-colors ${
                  hasMismatch ? 'border-rose-900 bg-rose-950/20' : 'border-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-neutral-500 font-sans">点棒合計</span>
                    <span className={`font-bold ${isScoreMismatch ? 'text-rose-400 font-black' : 'text-white'}`}>
                      {totalScore.toLocaleString()}点
                    </span>
                    {isScoreMismatch && (
                      <span className="text-[10px] font-sans font-black px-1.5 py-0.2 rounded bg-rose-600 text-white">
                        基準 {expectedTotalScore.toLocaleString()}点と不一致
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-neutral-500 font-sans">合計</span>
                    <span className={`font-bold ${isPtMismatch ? 'text-rose-400 font-black' : 'text-neutral-400'}`}>
                      {totalPt > 0 ? `+${totalPt.toFixed(1)}` : totalPt.toFixed(1)}pt
                    </span>
                    {isPtMismatch && (
                      <span className="text-[10px] font-sans font-black px-1.5 py-0.2 rounded bg-rose-600 text-white">
                        不一致
                      </span>
                    )}
                  </div>
                </div>
                {hasMismatch && (
                  <div className="text-[11px] font-sans text-rose-400 font-bold pt-1 border-t border-rose-900/40">
                    点棒またはポイントの合計が一致していません。局修正で入力内容をご確認ください。
                  </div>
                )}
              </div>

              {/* ボタン群 */}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmFinish}
                  className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.99] text-white font-black text-sm shadow-md transition-all flex items-center justify-center disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? '保存中...' : '成績を確定して保存 →'}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setSettleModalOpen(false)}
                    className="h-12 rounded-xl bg-neutral-950 hover:bg-neutral-800 active:bg-neutral-700 border border-neutral-800 text-neutral-200 font-black text-sm transition-all cursor-pointer flex items-center justify-center"
                  >
                    ← 対局に戻る
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleConfirmAbort}
                    className="h-12 rounded-xl bg-neutral-950 hover:bg-rose-950/40 active:bg-rose-900/50 border border-neutral-800 hover:border-rose-800/80 text-rose-400 font-black text-sm transition-all cursor-pointer flex items-center justify-center"
                  >
                    対局を破棄
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 詳細ルール確認モーダル */}
      {ruleDetailOpen && (
        <RuleDetailModal
          ruleName={game?.rule_name_snapshot || '対局ルール'}
          config={ruleConfig}
          onClose={() => setRuleDetailOpen(false)}
        />
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
