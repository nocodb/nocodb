import { USER_DEFAULT_CURRENCY_CODE_KEY, USER_DEFAULT_CURRENCY_LOCALE_KEY, getUserCurrencyDefaults } from 'nocodb-sdk'

/** The currency the signed-in user's new Currency fields start with. USD in en-US unless set. */
export const useDefaultCurrency = () => {
  const { user } = useGlobal()

  const defaultCurrency = computed(() => getUserCurrencyDefaults(user.value?.meta))

  const setDefaultCurrency = (value: { currency_code?: string; currency_locale?: string }) =>
    useUsers().updateUserMeta({
      ...(value.currency_code ? { [USER_DEFAULT_CURRENCY_CODE_KEY]: value.currency_code } : {}),
      ...(value.currency_locale ? { [USER_DEFAULT_CURRENCY_LOCALE_KEY]: value.currency_locale } : {}),
    })

  return { defaultCurrency, setDefaultCurrency }
}
