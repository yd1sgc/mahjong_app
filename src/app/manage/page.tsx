/**
 * /manage ルートのリダイレクト処理
 * /manage/groups へ即時転送
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ManageIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/manage/groups');
  }, [router]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <span className="text-xs text-neutral-500 font-bold">リダイレクト中...</span>
    </div>
  );
}
