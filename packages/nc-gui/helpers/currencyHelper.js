import locale from 'locale-codes'

export const currencyCodes = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD',
  'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF',
  'BMD', 'BND', 'BOB', 'BOV', 'BRL', 'BSD', 'BTN', 'BWP',
  'BYR', 'BZD', 'CAD', 'CDF', 'CHE', 'CHF', 'CHW', 'CLF',
  'CLP', 'CNY', 'COP', 'COU', 'CRC', 'CUP', 'CVE', 'CYP',
  'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EEK', 'EGP', 'ERN',
  'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHC', 'GIP',
  'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG',
  'HUF', 'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD',
  'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW',
  'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL',
  'LTL', 'LVL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK',
  'MNT', 'MOP', 'MRO', 'MTL', 'MUR', 'MVR', 'MWK', 'MXN',
  'MXV', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR',
  'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN',
  'PYG', 'QAR', 'ROL', 'RON', 'RSD', 'RUB', 'RWF', 'SAR',
  'SBD', 'SCR', 'SDD', 'SEK', 'SGD', 'SHP', 'SIT', 'SKK',
  'SLL', 'SOS', 'SRD', 'STD', 'SYP', 'SZL', 'THB', 'TJS',
  'TMM', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH',
  'UGX', 'USD', 'USN', 'USS', 'UYU', 'UZS', 'VEB', 'VND',
  'VUV', 'WST', 'XAF', 'XAG', 'XAU', 'XBA', 'XBB', 'XBC',
  'XBD', 'XCD', 'XDR', 'XFO', 'XFU', 'XOF', 'XPD', 'XPF',
  'XPT', 'XTS', 'XXX', 'YER', 'ZAR', 'ZMK', 'ZWD'
]

export function validateCurrencyCode(v) {
  return currencyCodes.includes(v)
}

export function currencyLocales() {
  const localeList = locale.all
    .filter((l) => {
      try {
        if (Intl.NumberFormat.supportedLocalesOf(l.tag).length > 0) {
          return true
        }
        return false
      } catch (e) {
        return false
      }
    })
    .map((l) => {
      return {
        text: l.name + ' (' + l.tag + ')',
        value: l.tag
      }
    })
  return localeList
}

export function validateCurrencyLocale(v) {
  try {
    return Intl.NumberFormat.supportedLocalesOf(v).length > 0
  } catch (e) {
    return false
  }
}

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Mert Ersoy <mertmit99@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
