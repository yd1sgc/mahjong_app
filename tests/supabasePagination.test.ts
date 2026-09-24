import { describe, it, expect, vi } from 'vitest';
import { fetchAllRows } from '@/lib/supabasePagination';

describe('supabasePagination: fetchAllRows', () => {
  it('データが空の場合は1回の呼び出しで空配列を返す', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: [], error: null });

    const result = await fetchAllRows(fetcher, 100);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(0, 99);
    expect(result).toEqual([]);
  });

  it('データがnullの場合は空配列を返す', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: null, error: null });

    const result = await fetchAllRows(fetcher, 100);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  it('データ件数がページサイズ未満の場合は1回で全件を返す', async () => {
    const mockData = [{ id: 1 }, { id: 2 }];
    const fetcher = vi.fn().mockResolvedValue({ data: mockData, error: null });

    const result = await fetchAllRows(fetcher, 10);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(0, 9);
    expect(result).toEqual(mockData);
  });

  it('複数ページに跨るデータを正しく結合して全件返す', async () => {
    // ページサイズ 2 で合計 5 件（2 + 2 + 1）
    const page1 = [{ id: 1 }, { id: 2 }];
    const page2 = [{ id: 3 }, { id: 4 }];
    const page3 = [{ id: 5 }];

    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: page2, error: null })
      .mockResolvedValueOnce({ data: page3, error: null });

    const result = await fetchAllRows(fetcher, 2);

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher).toHaveBeenNthCalledWith(1, 0, 1);
    expect(fetcher).toHaveBeenNthCalledWith(2, 2, 3);
    expect(fetcher).toHaveBeenNthCalledWith(3, 4, 5);
    expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
  });

  it('ちょうどページサイズの倍数件数の場合、空ページで終了する', async () => {
    // ページサイズ 2 で合計 4 件（2 + 2 + 0）
    const page1 = [{ id: 1 }, { id: 2 }];
    const page2 = [{ id: 3 }, { id: 4 }];
    const page3: any[] = [];

    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: page2, error: null })
      .mockResolvedValueOnce({ data: page3, error: null });

    const result = await fetchAllRows(fetcher, 2);

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
  });

  it('fetcherがエラーを返した場合に例外を投げる', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      data: null,
      error: new Error('PostgREST connection failed'),
    });

    await expect(fetchAllRows(fetcher, 100)).rejects.toThrow(
      'PostgREST connection failed'
    );
  });
});
