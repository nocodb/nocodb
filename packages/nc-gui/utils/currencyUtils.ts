import { CURRENCY_CODES } from 'nocodb-sdk'

export const currencyCodes = CURRENCY_CODES

export function validateCurrencyCode(v: string) {
  return currencyCodes.includes(v)
}

export async function currencyLocales() {
  const { all } = await import('./currencyCodes')
  return all
    .filter((l) => validateCurrencyLocale(l.tag))
    .map((l) => {
      return {
        text: `${l.name} (${l.tag})`,
        value: l.tag,
      }
    })
}

export function validateCurrencyLocale(v: string) {
  try {
    return Intl.NumberFormat.supportedLocalesOf(v).length > 0
  } catch (e) {
    return false
  }
}
