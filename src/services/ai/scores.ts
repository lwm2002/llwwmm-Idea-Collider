/** Interpret explicit score formats without guessing an unspecified scale. */
export function normalizeScore(input: unknown): number | null {
  if (typeof input === 'number')
    return Number.isFinite(input) && input >= 0 && input <= 100 ? input : null;
  if (typeof input !== 'string') return null;
  const text = input.normalize('NFKC').trim();
  const decimal = '(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
  const plain = text.match(new RegExp(`^(${decimal})\\s*(?:%|分)?$`));
  if (plain) return normalizeScore(Number(plain[1]));
  const fraction = text.match(new RegExp(`^(${decimal})\\s*/\\s*(100|10|5)$`));
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    return numerator <= denominator ? normalizeScore((numerator / denominator) * 100) : null;
  }
  return null;
}

export const formatScore = (score: number | null) => (score === null ? '未评分' : String(score));
