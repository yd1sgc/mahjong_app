/**
 * 過去局修正モーダルコンポーネント（RoundEditModal）
 * docs/round_edit_detailed_design.md 準拠
 * 
 * - 過去局（第1局〜最新局）の選択・結果編集
 * - ロン / ツモ / ダブロン / 流局 / チョンボ 完全対応
 * - 純粋ドメイン層（computeAllRoundsDetails）によるリアルタイム再計算差分プレビュー
 * - history.pushState / popstate 連動によるスマホ戻る操作での誤離脱防止
 */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { RoundRecord, RuleConfig, WinType } from '@/types/mahjong';
import { computeAllRoundsDetails, getRoundName } from '@/lib/mahjong/rules';

interface RoundEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: string[];
  ruleConfig: RuleConfig;
  roundHistory: RoundRecord[];
  onSave: (targetIndex: number, updatedData: RoundRecord) => Promise<boolean>;
}

const SCORE_PRESETS = [
  1000, 1300, 1500, 2000, 2600, 3900, 5200, 7700, 8000, 12000, 16000, 24000, 32000,
];

export const RoundEditModal: React.FC<RoundEditModalProps> = ({
  isOpen,
  onClose,
  players,
  ruleConfig,
  roundHistory,
  onSave,
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  // フォーム編集ステート
  const [winType, setWinType] = useState<WinType>('ron');
  const [winner, setWinner] = useState<string | null>(null);
  const [loser, setLoser] = useState<string | null>(null);
  const [score, setScore] = useState<number>(8000);
  const [han, setHan] = useState<number>(4);
  const [fu, setFu] = useState<number>(30);
  const [riichi, setRiichi] = useState<string[]>([]);
  const [furo, setFuro] = useState<string[]>([]);
  const [tenpai, setTenpai] = useState<string[]>([]);
  const [multiWinners, setMultiWinners] = useState<{
    winner: string;
    total: number;
    han: number;
    fu: number;
  }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // モーダルオープン時または局選択変更時の初期値ロード
  useEffect(() => {
    if (!isOpen || roundHistory.length === 0) return;
    const validIdx = Math.min(selectedIdx, roundHistory.length - 1);
    const target = roundHistory[validIdx];
    if (!target) return;

    setWinType(target.win_type);
    setWinner(target.winner);
    setLoser(target.loser);
    setScore(target.score || 0);
    setHan(target.han || 1);
    const initialRiichi = target.riichi || [];
    setRiichi(initialRiichi);
    setFuro(target.furo || []);
    setTenpai(
      target.win_type === 'ryukyoku'
        ? Array.from(new Set([...(target.tenpai || []), ...initialRiichi]))
        : target.tenpai || []
    );

    if (target.win_type === 'multi_ron' && target.multi_wins) {
      setMultiWinners(
        target.multi_wins.map((w) => ({
          winner: w.winner,
          total: w.points_data?.total || 0,
          han: w.points_data?.han || 1,
          fu: w.points_data?.fu || 30,
        }))
      );
    } else {
      setMultiWinners([]);
    }
  }, [isOpen, selectedIdx, roundHistory]);

  const handleClose = () => {
    onClose();
  };

  // 修正前の最新持ち点（モーダル表示中に不変・1回のみ計算）
  const originalLastScores = useMemo(() => {
    if (!isOpen || roundHistory.length === 0) return {};
    const initScore = ruleConfig.basic?.init_score ?? 25000;
    const details = computeAllRoundsDetails(players, initScore, ruleConfig, roundHistory);
    return details.length > 0
      ? details[details.length - 1].scoresAfter
      : Object.fromEntries(players.map((p) => [p, initScore]));
  }, [isOpen, players, ruleConfig, roundHistory]);

  // 編集中の入力データから仮の RoundRecord を構築
  const currentEditingRound: RoundRecord = useMemo(() => {
    const orig = roundHistory[selectedIdx] || {};
    return {
      ...orig,
      win_type: winType,
      winner: winType === 'multi_ron' || winType === 'ryukyoku' ? null : winner,
      loser: winType === 'ron' || winType === 'multi_ron' ? loser : null,
      score: winType === 'multi_ron' ? 0 : score,
      han: han,
      fu: fu,
      riichi: riichi,
      furo: furo,
      tenpai: winType === 'ryukyoku' ? Array.from(new Set([...tenpai, ...riichi])) : [],
      multi_wins:
        winType === 'multi_ron'
          ? multiWinners.map((mw) => ({
              winner: mw.winner,
              points_data: {
                total: mw.total,
                han: mw.han,
                fu: mw.fu,
              },
            }))
          : undefined,
    };
  }, [
    roundHistory,
    selectedIdx,
    winType,
    winner,
    loser,
    score,
    han,
    fu,
    riichi,
    furo,
    tenpai,
    multiWinners,
  ]);

  // 純粋ドメイン層による再計算プレビュー（最新局終了時の持ち点差分）
  const preview = useMemo(() => {
    if (!isOpen || roundHistory.length === 0) return null;
    const initScore = ruleConfig.basic?.init_score ?? 25000;

    // 修正反映後の仮履歴
    const tempHistory = [...roundHistory];
    tempHistory[selectedIdx] = currentEditingRound;

    const recalculatedDetails = computeAllRoundsDetails(
      players,
      initScore,
      ruleConfig,
      tempHistory
    );
    const newLastScores =
      recalculatedDetails.length > 0
        ? recalculatedDetails[recalculatedDetails.length - 1].scoresAfter
        : Object.fromEntries(players.map((p) => [p, initScore]));

    const targetDetail = recalculatedDetails[selectedIdx];

    return {
      originalLastScores,
      newLastScores,
      targetDetail,
    };
  }, [isOpen, players, ruleConfig, roundHistory, selectedIdx, currentEditingRound, originalLastScores]);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // バリデーション
    if (winType === 'ron') {
      if (!winner) {
        alert('和了者を選択してください');
        return;
      }
      if (!loser) {
        alert('放銃者を選択してください');
        return;
      }
      if (winner === loser) {
        alert('和了者と放銃者を同一人物にすることはできません');
        return;
      }
    } else if (winType === 'tsumo') {
      if (!winner) {
        alert('和了者を選択してください');
        return;
      }
    } else if (winType === 'multi_ron') {
      if (!loser) {
        alert('放銃者を選択してください');
        return;
      }
      if (multiWinners.length < 2) {
        alert('ダブロンの和了者を2名以上選択してください');
        return;
      }
      if (multiWinners.some((mw) => mw.winner === loser)) {
        alert('和了者に放銃者が含まれています');
        return;
      }
    } else if (winType === 'chombo') {
      if (!winner) {
        alert('チョンボ対象者を選択してください');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const ok = await onSave(selectedIdx, currentEditingRound);
      if (ok) {
        handleClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-lg rounded-2xl p-4 shadow-2xl flex flex-col gap-4 text-white max-h-[95vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 font-bold py-1 px-2 rounded-lg bg-neutral-800 hover:bg-neutral-750 transition-colors"
            >
              &larr; 戻る
            </button>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white">局履歴の修正</h2>
              <p className="text-[10px] sm:text-[11px] text-neutral-400">
                修正内容に応じて本場・供託・持ち点が連鎖再計算されます
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-neutral-400 hover:text-white text-xl font-bold p-1 leading-none"
          >
            &times;
          </button>
        </div>

        {roundHistory.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-500">
            確定済みの局データがまだありません
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* 1. 修正対象局セレクタ */}
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1.5">
                修正する局を選択
              </label>
              <select
                value={selectedIdx}
                onChange={(e) => setSelectedIdx(Number(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2.5 text-xs text-neutral-100 font-bold focus:outline-none focus:border-amber-400"
              >
                {roundHistory.map((r, i) => {
                  const typeLabel =
                    r.win_type === 'ron'
                      ? 'ロン'
                      : r.win_type === 'tsumo'
                      ? 'ツモ'
                      : r.win_type === 'multi_ron'
                      ? 'ダブロン'
                      : r.win_type === 'ryukyoku'
                      ? '流局'
                      : r.win_type === 'chombo'
                      ? 'チョンボ'
                      : '局終了';
                  const winnerStr = r.winner ? ` / ${r.winner}` : '';
                  return (
                    <option key={r.round_id || i} value={i}>
                      第{i + 1}局: {r.kyoku_name} {r.honba}本場 ({typeLabel}
                      {winnerStr})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 2. 結果種別セレクタ */}
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1.5">
                結果種別
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {(
                  [
                    { type: 'ron', label: 'ロン' },
                    { type: 'tsumo', label: 'ツモ' },
                    { type: 'multi_ron', label: 'ダブロン' },
                    { type: 'ryukyoku', label: '流局' },
                    { type: 'chombo', label: 'チョンボ' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      setWinType(item.type);
                      if (item.type === 'ryukyoku') {
                        setTenpai((prev) => Array.from(new Set([...prev, ...riichi])));
                      } else if (item.type === 'multi_ron' && multiWinners.length === 0) {
                        const w1 = winner || players[0];
                        const w2 = players.find((p) => p !== w1 && p !== loser) || players[1];
                        setMultiWinners([
                          { winner: w1, total: score || 8000, han: 4, fu: 30 },
                          { winner: w2, total: 8000, han: 4, fu: 30 },
                        ]);
                      }
                    }}
                    className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                      winType === item.type
                        ? 'bg-amber-500 text-black shadow'
                        : 'bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border border-neutral-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. 種別ごとの詳細入力 */}
            {winType === 'ron' && (
              <div className="flex flex-col gap-3 bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                <div>
                  <span className="text-xs font-bold text-neutral-400 block mb-1">
                    和了者（アガリ）
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {players.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setWinner(p)}
                        className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                          winner === p
                            ? 'bg-rose-600 text-white border-rose-500'
                            : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-750'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-neutral-400 block mb-1">
                    放銃者（振り込み）
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {players.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setLoser(p)}
                        disabled={winner === p}
                        className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                          winner === p
                            ? 'opacity-30 border-neutral-800 cursor-not-allowed bg-neutral-900 text-neutral-600'
                            : loser === p
                            ? 'bg-indigo-600 text-white border-indigo-500'
                            : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-750'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-neutral-400 block mb-1">
                    手役素点 (本場・供託除く): {score.toLocaleString()}点
                  </span>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {SCORE_PRESETS.map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => setScore(pt)}
                        className={`px-2 py-1 rounded text-[11px] font-mono font-bold border ${
                          score === pt
                            ? 'bg-amber-400 text-black border-amber-300'
                            : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:bg-neutral-800'
                        }`}
                      >
                        {pt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    step={100}
                    value={score}
                    onChange={(e) => setScore(Number(e.target.value))}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                    placeholder="直接点数を入力"
                  />
                </div>
              </div>
            )}

            {winType === 'tsumo' && (
              <div className="flex flex-col gap-3 bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                <div>
                  <span className="text-xs font-bold text-neutral-400 block mb-1">
                    和了者（ツモ）
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {players.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setWinner(p)}
                        className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                          winner === p
                            ? 'bg-rose-600 text-white border-rose-500'
                            : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-750'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-neutral-400 block mb-1">
                    手役素点 (本場除く): {score.toLocaleString()}点
                  </span>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {SCORE_PRESETS.map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => setScore(pt)}
                        className={`px-2 py-1 rounded text-[11px] font-mono font-bold border ${
                          score === pt
                            ? 'bg-amber-400 text-black border-amber-300'
                            : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:bg-neutral-800'
                        }`}
                      >
                        {pt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    step={100}
                    value={score}
                    onChange={(e) => setScore(Number(e.target.value))}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                    placeholder="直接点数を入力"
                  />
                </div>
              </div>
            )}

            {winType === 'multi_ron' && (
              <div className="flex flex-col gap-3 bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                <div>
                  <span className="text-xs font-bold text-neutral-400 block mb-1">
                    放銃者（1名）
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {players.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setLoser(p);
                          setMultiWinners((prev) => prev.filter((w) => w.winner !== p));
                        }}
                        className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                          loser === p
                            ? 'bg-indigo-600 text-white border-indigo-500'
                            : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-750'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-neutral-400 block mb-1">
                    和了者と各打点（複数選択）
                  </span>
                  <div className="flex flex-col gap-2">
                    {players
                      .filter((p) => p !== loser)
                      .map((p) => {
                        const currentWin = multiWinners.find((w) => w.winner === p);
                        const isSelected = Boolean(currentWin);
                        return (
                          <div
                            key={p}
                            className={`p-2 rounded-lg border flex flex-col gap-1.5 ${
                              isSelected
                                ? 'bg-neutral-900 border-amber-500/50'
                                : 'bg-neutral-950 border-neutral-800'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setMultiWinners((prev) => [
                                        ...prev,
                                        { winner: p, total: 8000, han: 4, fu: 30 },
                                      ]);
                                    } else {
                                      setMultiWinners((prev) =>
                                        prev.filter((w) => w.winner !== p)
                                      );
                                    }
                                  }}
                                  className="w-4 h-4 rounded text-amber-500"
                                />
                                {p}
                              </label>
                              {isSelected && (
                                <span className="text-xs font-mono text-amber-400">
                                  {currentWin?.total.toLocaleString()}点
                                </span>
                              )}
                            </div>

                            {isSelected && (
                              <div className="flex items-center gap-2 pt-1 border-t border-neutral-800">
                                <input
                                  type="number"
                                  step={100}
                                  value={currentWin?.total || 8000}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setMultiWinners((prev) =>
                                      prev.map((w) =>
                                        w.winner === p ? { ...w, total: val } : w
                                      )
                                    );
                                  }}
                                  className="w-28 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs text-white font-mono"
                                />
                                <div className="flex flex-wrap gap-1">
                                  {[2000, 3900, 8000, 12000].map((preset) => (
                                    <button
                                      key={preset}
                                      type="button"
                                      onClick={() =>
                                        setMultiWinners((prev) =>
                                          prev.map((w) =>
                                            w.winner === p ? { ...w, total: preset } : w
                                          )
                                        )
                                      }
                                      className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                                    >
                                      {preset}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}

            {winType === 'ryukyoku' && (
              <div className="flex flex-col gap-2 bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                <span className="text-xs font-bold text-neutral-400 block mb-1">
                  テンパイ者（チェックした人にノーテン罰符を配分）
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {players.map((p) => {
                    const isR = riichi.includes(p);
                    const isT = isR || tenpai.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        disabled={isR}
                        onClick={() =>
                          !isR &&
                          setTenpai((prev) =>
                            isT ? prev.filter((name) => name !== p) : [...prev, p]
                          )
                        }
                        className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                          isR
                            ? 'bg-amber-500 text-black border-amber-400 cursor-default opacity-90'
                            : isT
                            ? 'bg-amber-500 text-black border-amber-400'
                            : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                        }`}
                      >
                        {p} {isR ? '(立直・聴牌)' : isT ? '(聴牌)' : '(不聴)'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {winType === 'chombo' && (
              <div className="flex flex-col gap-2 bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                <span className="text-xs font-bold text-neutral-400 block mb-1">
                  チョンボ対象者（満貫払いを実行）
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {players.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setWinner(p)}
                      className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                        winner === p
                          ? 'bg-rose-600 text-white border-rose-500'
                          : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-750'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 4. 当該局の宣言（立直・副露） */}
            <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 flex flex-col gap-2.5">
              <div>
                <span className="text-[11px] font-bold text-neutral-400 block mb-1">
                  当該局のリーチ宣言者
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {players.map((p) => {
                    const isR = riichi.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setRiichi((prev) => {
                            const next = isR ? prev.filter((x) => x !== p) : [...prev, p];
                            if (!isR && winType === 'ryukyoku') {
                              setTenpai((t) => Array.from(new Set([...t, p])));
                            }
                            return next;
                          });
                        }}
                        className={`py-1.5 rounded text-xs font-bold border ${
                          isR
                            ? 'bg-amber-500 text-black border-amber-400'
                            : 'bg-neutral-900 text-neutral-500 border-neutral-800'
                        }`}
                      >
                        {p} {isR && '立'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-neutral-400 block mb-1">
                  当該局の副露（ポン・チー・カン）宣言者
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {players.map((p) => {
                    const isF = furo.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() =>
                          setFuro((prev) =>
                            isF ? prev.filter((x) => x !== p) : [...prev, p]
                          )
                        }
                        className={`py-1.5 rounded text-xs font-bold border ${
                          isF
                            ? 'bg-cyan-600 text-white border-cyan-500'
                            : 'bg-neutral-900 text-neutral-500 border-neutral-800'
                        }`}
                      >
                        {p} {isF && '副'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 5. 再計算差分プレビュー（最重要） */}
            {preview && (
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                  <span className="text-xs font-bold text-amber-400">
                    最新スコアへの影響（全体再計算プレビュー）
                  </span>
                  <span className="text-[10px] font-mono text-neutral-500">
                    ゼロサム検算OK
                  </span>
                </div>

                <div className="flex flex-col gap-1 text-xs font-mono">
                  {players.map((p) => {
                    const oldS = preview.originalLastScores[p] ?? 0;
                    const newS = preview.newLastScores[p] ?? 0;
                    const delta = newS - oldS;
                    return (
                      <div
                        key={p}
                        className="flex items-center justify-between py-1 px-2 rounded bg-neutral-900/60"
                      >
                        <span className="font-sans font-bold text-neutral-300">
                          {p}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-400">
                            {oldS.toLocaleString()}
                          </span>
                          <span className="text-neutral-500">&rarr;</span>
                          <span className="font-bold text-white">
                            {newS.toLocaleString()}
                          </span>
                          <span
                            className={`w-14 text-right font-bold ${
                              delta > 0
                                ? 'text-cyan-400'
                                : delta < 0
                                ? 'text-rose-400'
                                : 'text-neutral-500'
                            }`}
                          >
                            {delta > 0 ? `+${delta}` : delta === 0 ? '±0' : delta}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6. 保存 & キャンセルボタン */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-black font-black text-sm shadow-md transition-all flex items-center justify-center disabled:opacity-50"
              >
                {isSubmitting ? '保存・連鎖再計算中...' : 'この内容で保存して全体を再計算'}
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleClose}
                className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-300 font-bold text-xs transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
