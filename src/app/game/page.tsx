/**
 * 対局入力・リアルタイム共有画面（静的SPA完全対応版: /game?id=xxx）
 * docs/DETAILED_DESIGN.md 準拠
 */

'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useGame } from '@/hooks/useGame';
import { ScoreBoard } from '@/components/ScoreBoard';
import { ActionPanel } from '@/components/ActionPanel';
import { RoundInputModal } from '@/components/RoundInputModal';
import { PinTransferModal } from '@/components/PinTransferModal';
import { WinType } from '@/types/mahjong';

function GameContent() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get('id') || '';

  const {
    loading,
    error,
    game,
    players,
    ruleConfig,
    gameState,
    isRecorder,
    gameEndReason,
    draft,
    updateDraft,
    transferRecorder,
    toggleFuro,
    declareRiichi,
    commitRound,
    undoRound,
  } = useGame(gameId);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalWinType, setModalWinType] = useState<WinType>('ron');
  const [pinModalOpen, setPinModalOpen] = useState(false);

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
    <main className="h-[100dvh] max-h-[100dvh] bg-black text-white flex flex-col justify-between max-w-xl mx-auto p-2.5 sm:p-3 select-none touch-manipulation overflow-hidden">
      {/* 上部ヘッダー */}
      <header className="flex items-center justify-between py-1.5 border-b border-neutral-800 shrink-0">
        <Link
          href="/"
          className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 font-bold"
        >
          &larr; 戻る
        </Link>
        <div className="text-center">
          <h1 className="text-sm font-black text-neutral-100">
            {game?.rule_name_snapshot || '対局'}
          </h1>
          <span className="text-[10px] text-neutral-500 font-semibold">
            {game?.played_at?.slice(0, 16) || ''}
          </span>
        </div>
        <span className="text-[11px] font-mono font-bold text-neutral-400 uppercase">
          ID: {gameId.slice(0, 6)}
        </span>
      </header>

      {/* 終局・サドンデス・飛び通知バナー */}
      {gameEndReason && (
        <div className="my-1 p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-center font-black text-xs shrink-0">
          [終局条件] {gameEndReason}
        </div>
      )}

      {/* スコアボード (中央メイン・4行リスト) */}
      <div className="flex-1 flex flex-col justify-center my-auto overflow-hidden">
        <ScoreBoard
          players={players}
          gameState={gameState}
          onRiichiClick={declareRiichi}
          onFuroClick={toggleFuro}
          isRecorder={isRecorder}
        />
      </div>

      {/* 下部操作パネル */}
      <footer className="mt-2">
        <ActionPanel
          isRecorder={isRecorder}
          passcode={game?.passcode || '0000'}
          onOpenWinModal={handleOpenWinModal}
          onOpenRyukyokuModal={handleOpenRyukyokuModal}
          onOpenChomboModal={handleOpenChomboModal}
          onUndoClick={undoRound}
          onOpenTransferModal={() => setPinModalOpen(true)}
          canUndo={(gameState?.roundHistory.length ?? 0) > 0}
        />
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
        onCommit={commitRound}
        initialWinType={modalWinType}
      />

      {/* 4桁PIN引き継ぎモーダル */}
      <PinTransferModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onTransfer={transferRecorder}
      />
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
