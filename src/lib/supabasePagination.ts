/**
 * Supabase (PostgREST) ページネーション共通ヘルパー
 * 
 * PostgREST のデフォルト取得上限（1,000行）を安全に突破し、
 * 全行を分割自動取得する。
 */

export async function fetchAllRows<T>(
  fetcher: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize = 1000
): Promise<T[]> {
  let allRows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await fetcher(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allRows;
}
