import { Logger } from '@nestjs/common';
import { isValidCurrencyCode, isValidCurrencyLocale } from 'nocodb-sdk';
import type { CurrencyDefaults } from 'nocodb-sdk';

const logger = new Logger('InstanceCurrencyDefault');
const warned = new Set<string>();

function warnOnce(name: string, value: string) {
  if (warned.has(name)) return;
  warned.add(name);
  logger.warn(`Ignoring ${name}="${value}": not a valid value`);
}

/** The instance-wide default currency for new currency fields, from env. Invalid values are left out. */
export function getInstanceCurrencyDefault(): CurrencyDefaults {
  const result: CurrencyDefaults = {};

  const code = process.env.NC_DEFAULT_CURRENCY_CODE?.trim().toUpperCase();
  if (code) {
    if (isValidCurrencyCode(code)) result.currency_code = code;
    else warnOnce('NC_DEFAULT_CURRENCY_CODE', code);
  }

  const locale = process.env.NC_DEFAULT_CURRENCY_LOCALE?.trim();
  if (locale) {
    if (isValidCurrencyLocale(locale)) result.currency_locale = locale;
    else warnOnce('NC_DEFAULT_CURRENCY_LOCALE', locale);
  }

  return result;
}
