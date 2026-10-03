// Стенд: сети нет — любые запросы возвращают пустой результат
const result = { data: null, error: null };
const chain: unknown = new Proxy(function () {}, {
  get: (_t, k) => (k === 'then' ? (res: (v: typeof result) => void) => res(result) : chain),
  apply: () => chain,
});
export const supabase = chain as never;
export const isSupabaseConfigured = false;
export const supabaseUrl = '';
