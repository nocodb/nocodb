/** One number as typed: 1e6, 1,000.5, 12, .5 (no sign, no suffix). */
export const NUM = String.raw`(\d+(?:\.\d+)?e\d+|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)`

export const MULTIPLIERS: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  hundred: 1e2,
  dozen: 12,
  m: 1e6,
  mn: 1e6,
  mil: 1e6,
  million: 1e6,
  b: 1e9,
  bn: 1e9,
  billion: 1e9,
}

/** The one-letter suffixes a calculator or quick-create number accepts ("5k", "2m"). */
export const SUFFIX: Record<string, number> = { k: MULTIPLIERS.k!, m: MULTIPLIERS.m! }

export const WORD_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  couple: 2,
}

export const CURRENCY_SYMBOLS = '$€£₹¥'

/**
 * A single number token: "10k", "$2.5m", "1,000", "-5", "12%", "ten". Undefined when it isn't one.
 * `percent` is set for a trailing %.
 */
export function readCmdNumber(token: string): { value: number; percent?: boolean } | undefined {
  const lower = token.toLowerCase()
  if (lower in WORD_NUMBERS) return { value: WORD_NUMBERS[lower]! }
  const match = new RegExp(String.raw`^[${CURRENCY_SYMBOLS}]?(-?)${NUM}(k|m|mn|bn|b)?(%)?$`).exec(lower)
  if (!match) return
  const value = Number(match[2]!.replace(/,/g, '')) * (match[3] ? MULTIPLIERS[match[3]]! : 1) * (match[1] ? -1 : 1)
  return Number.isFinite(value) ? { value, percent: !!match[4] } : undefined
}
