import {
  getUserCurrencyDefaults,
  USER_DEFAULT_CURRENCY_CODE_KEY,
  USER_DEFAULT_CURRENCY_LOCALE_KEY,
} from './currencyHelpers';

describe('getUserCurrencyDefaults', () => {
  it('falls back to USD in en-US without a preference', () => {
    expect(getUserCurrencyDefaults(undefined)).toEqual({
      currency_code: 'USD',
      currency_locale: 'en-US',
    });
  });

  it('uses the saved preference, from an object or a JSON string', () => {
    const meta = {
      [USER_DEFAULT_CURRENCY_CODE_KEY]: 'IDR',
      [USER_DEFAULT_CURRENCY_LOCALE_KEY]: 'id-ID',
    };
    const expected = { currency_code: 'IDR', currency_locale: 'id-ID' };
    expect(getUserCurrencyDefaults(meta)).toEqual(expected);
    expect(getUserCurrencyDefaults(JSON.stringify(meta))).toEqual(expected);
  });

  it('replaces each invalid value on its own', () => {
    expect(
      getUserCurrencyDefaults({
        [USER_DEFAULT_CURRENCY_CODE_KEY]: 'idr',
        [USER_DEFAULT_CURRENCY_LOCALE_KEY]: 'de-DE',
      })
    ).toEqual({ currency_code: 'USD', currency_locale: 'de-DE' });
    expect(getUserCurrencyDefaults('not json')).toEqual({
      currency_code: 'USD',
      currency_locale: 'en-US',
    });
  });
});
