type Page<T> = { data: T[] | null; error: { message: string } | null };

/** Supabase caps every request at 1000 rows by default, so read bigger tables page by page. */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<Page<T>>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) return all;
  }
}
