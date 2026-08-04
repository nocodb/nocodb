import type { Ref } from 'vue'

/**
 * Resolves which link-record UI an LTAR cell should render.
 *
 * Interface grid/list viz hosts provide `LinkRecordDropdownVariantInj` as
 * `'simple'`; everywhere else the injection default keeps `'classic'`. On top
 * of the provided value, forms (incl. the interface record-details layout,
 * which runs the form engine), expanded records and lookups always stay
 * classic — the simple picker replaces the inline-edit surface only.
 *
 * Read-only cells stay on the simple picker too, in browse mode: same chrome
 * (select-style chevron), same panel, but linked records only and no
 * check/link affordances. Routing them to the classic modal instead would open
 * a 540px search-to-link surface out of a 320px interface chevron.
 */
export function useLinkRecordDropdownVariant(hasEditPermission: Ref<boolean>) {
  const variant = inject(LinkRecordDropdownVariantInj, ref('classic'))

  const isForm = inject(IsFormInj, ref(false))

  const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

  const isUnderLookup = inject(IsUnderLookupInj, ref(false))

  /** The surface renders the simple picker — chrome AND panel, read-only included. */
  const isSimpleLinkRecordList = computed(
    () => variant.value === 'simple' && !isForm.value && !isExpandedFormOpen.value && !isUnderLookup.value,
  )

  /** Same picker, browse mode — passed to the panel as `readonly`. */
  const isSimpleLinkRecordListReadonly = computed(() => isSimpleLinkRecordList.value && !hasEditPermission.value)

  return { isSimpleLinkRecordList, isSimpleLinkRecordListReadonly }
}
