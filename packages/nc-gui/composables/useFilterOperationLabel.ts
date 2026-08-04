// `comparisonOpList` / `comparisonSubOpList` in nocodb-sdk carry both a
// hardcoded English `text` and an optional `i18nKey` for each operator. This
// composable renders the label in the active locale from that key, falling back
// to the English `text` when there is no key (e.g. symbol operators '=', '>').
export function useFilterOperationLabel() {
  const { t } = useI18n()

  const getFilterOpLabel = (i18nKey?: string | null, fallbackText?: string | null): string => {
    if (i18nKey) return t(i18nKey)

    return fallbackText ?? ''
  }

  return { getFilterOpLabel }
}
