export const precisions = [
  { id: 0, title: '1' },
  { id: 1, title: '1.0' },
  { id: 2, title: '1.00' },
  { id: 3, title: '1.000' },
  { id: 4, title: '1.0000' },
  { id: 5, title: '1.00000' },
  { id: 6, title: '1.000000' },
  { id: 7, title: '1.0000000' },
  { id: 8, title: '1.00000000' },
]

export function renderPercent(value: any, precision: number, withPercentSymbol = true) {
  if (!value) return value
  value = (Number(value) * 100).toFixed(precision)
  if (withPercentSymbol) return padPercentSymbol(value)
  return value
}

export function isValidPercent(value: any, negative: boolean): boolean {
  return negative ? /^-?\d{1,20}(\.\d+)?$/.test(value) : /^\d{1,20}(\.\d+)?$/.test(value)
}

export function getPercentStep(precision: number): string {
  return (1 / 10 ** precision).toString()
}

function padPercentSymbol(value: any) {
  return value ? `${value}%` : value
}
