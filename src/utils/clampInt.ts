export function clampInt(
  v: string | null,
  min: number,
  max: number,
  fallback: number
) {
  const n = v === null ? NaN : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}