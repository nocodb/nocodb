/** Names a full-page view's way out after where it was opened from: a base, else the workspace; neutral when landed on directly. */
export const useBackLabel = (origin: MaybeRefOrGetter<string | null | undefined>) => {
  const router = useRouter()

  const { t } = useI18n()

  const { bases } = storeToRefs(useBases())

  const { activeWorkspace } = storeToRefs(useWorkspace())

  return computed(() => {
    const path = toValue(origin)

    if (!path) return t('labels.backToWorkspace')

    const { params } = router.resolve(path)

    // CE has one workspace, and its bases live under `/nc/`, not under its id.
    if (isEeUI && params.typeOrId !== activeWorkspace.value?.id) return t('labels.backToWorkspace')

    const baseTitle = typeof params.baseId === 'string' ? bases.value.get(params.baseId)?.title : undefined

    const name = baseTitle || (isEeUI ? activeWorkspace.value?.title : undefined)

    return name ? t('labels.backTo', { name }) : t('labels.backToWorkspace')
  })
}
