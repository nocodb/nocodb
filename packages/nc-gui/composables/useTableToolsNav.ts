import type { ShellRailGroup } from '~/components/shell/Rail.vue'
import type { ViewPageType } from '~/lib/types'

// Tools gates + groups, shared by the shell rail and the toolbar dropdown.
export const useTableToolsNav = () => {
  const { t } = useI18n()

  const { isUIAllowed } = useRoles()

  const { showEEFeatures } = useEeConfig()

  const { isSqlView } = useSmartsheetStoreOrThrow()

  const showFieldsAction = computed(() => isUIAllowed('fieldAdd') && !isSqlView.value)

  const showWebhooksAction = computed(() => isUIAllowed('hookList') && !isSqlView.value)

  const showPermissionsAction = computed(
    () => isEeUI && isUIAllowed('tablePermission') && !isSqlView.value && showEEFeatures.value,
  )

  const showRlsAction = computed(() => isEeUI && isUIAllowed('rlsManage') && !isSqlView.value && showEEFeatures.value)

  const showDateDependencyAction = computed(
    () => isEeUI && isUIAllowed('dateDependencyManage') && !isSqlView.value && showEEFeatures.value,
  )

  // Base-level, so reachable from any view; EDITOR+ ACL.
  const showRecordTemplatesAction = computed(() => isEeUI && isUIAllowed('viewOperations') && showEEFeatures.value)

  // Relations / API are always available.
  const tabAvailability = computed<Partial<Record<ViewPageType, boolean>>>(() => ({
    field: showFieldsAction.value,
    relation: true,
    permissions: showPermissionsAction.value,
    rls: showRlsAction.value,
    templates: showRecordTemplatesAction.value,
    dates: showDateDependencyAction.value,
    api: true,
    webhook: showWebhooksAction.value,
  }))

  const toolGroups = computed<ShellRailGroup[]>(() => {
    const structure = [
      showFieldsAction.value && { slug: 'field' as const, icon: 'ncList', title: t('general.manageFields') },
      { slug: 'relation' as const, icon: 'ncErd', title: t('title.relations') },
    ].filter(Boolean) as ShellRailGroup['items']

    const access = [
      showPermissionsAction.value && {
        slug: 'permissions' as const,
        icon: 'ncLock',
        title: t('general.permissions'),
      },
      showRlsAction.value && {
        slug: 'rls' as const,
        icon: 'ncShield',
        title: t('objects.permissions.rlsPolicy.rowLevelSecurity'),
      },
    ].filter(Boolean) as ShellRailGroup['items']

    const records = [
      showRecordTemplatesAction.value && {
        slug: 'templates' as const,
        icon: 'ncClipboard',
        title: t('objects.recordTemplates'),
      },
      showDateDependencyAction.value && {
        slug: 'dates' as const,
        icon: 'ncCalendar',
        title: t('labels.dateDependency.title'),
      },
    ].filter(Boolean) as ShellRailGroup['items']

    const developer = [
      showWebhooksAction.value && { slug: 'webhook' as const, icon: 'ncWebhook', title: t('objects.webhooks') },
      { slug: 'api' as const, icon: 'ncCode', title: t('labels.apiSnippet') },
    ].filter(Boolean) as ShellRailGroup['items']

    return [
      { label: t('labels.toolsSectionStructure'), items: structure },
      { label: t('labels.toolsSectionAccess'), items: access },
      { label: t('labels.toolsSectionRecords'), items: records },
      { label: t('labels.toolsSectionDeveloper'), items: developer },
    ]
  })

  return { tabAvailability, toolGroups }
}
