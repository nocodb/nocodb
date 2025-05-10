<script lang="ts" setup>
import { LoadingOutlined } from '@ant-design/icons-vue'
import Automation from '../Automation.vue'

interface Props {}

const props = withDefaults(defineProps<Props>(), {})

const {} = toRefs(props)

const indicator = h(LoadingOutlined, {
  class: '!text-gray-400',
  style: {
    fontSize: '0.85rem',
  },
  spin: true,
})

const router = useRouter()
const route = router.currentRoute

const { isNewSidebarEnabled } = storeToRefs(useSidebarStore())

const { isSharedBase } = storeToRefs(useBase())
const { baseUrl } = useBase()

const { setMenuContext, duplicateTable, contextMenuTarget, tableRenameId } = inject(TreeViewInj)!

const { isMobileMode, user, navigateToProject } = useGlobal()

const { api } = useApi()

const { isFeatureEnabled } = useBetaFeatureToggle()

const base = inject(ProjectInj)!

// For starred base we will have seperate isExpanded state
const isExpanded = computed<boolean>({
  get: () => {
    return !!base.value.isExpanded
  },
  set: (val: boolean) => {
    base.value.isExpanded = val
  },
})

const basesStore = useBases()

const { createProject: _createProject, updateProject, toggleStarred, loadProject } = basesStore

const { bases, activeProjectId, basesUser } = storeToRefs(basesStore)

const collaborators = computed(() => {
  return (basesUser.value.get(base.value?.id) || []).map((user: any) => {
    return {
      ...user,
      base_roles: user.roles,
      roles:
        user.roles ??
        (user.workspace_roles
          ? WorkspaceRolesToProjectRoles[user.workspace_roles as WorkspaceUserRoles] ?? ProjectRoles.NO_ACCESS
          : ProjectRoles.NO_ACCESS),
    }
  })
})

const currentUserRole = computed(() => {
  return collaborators.value.find((coll) => coll.id === user.value?.id)?.roles as keyof typeof RoleLabels
})

const { loadProjectTables } = useTablesStore()

const { activeTable } = storeToRefs(useTablesStore())

const { allRecentViews } = storeToRefs(useViewsStore())

const { appInfo } = useGlobal()

useTabs()

const { meta: metaKey, control } = useMagicKeys()

const editMode = ref(false)

const tempTitle = ref('')

const sourceRenameHelpers = ref<
  Record<
    string,
    {
      editMode: boolean
      tempTitle: string
    }
  >
>({})

// const { t } = useI18n()

const input = ref<HTMLInputElement>()

const { isUIAllowed } = useRoles()

const { refreshCommandPalette } = useCommandPalette()

const { addNewLayout, getDashboardProjectUrl: dashboardProjectUrl, populateLayouts } = useDashboardStore()

const { addNewPage, populatedNestedPages, baseUrl: docsProjectUrl } = useDocStore()

const { $e } = useNuxtApp()

const { copy } = useCopy()

const { showRecordPlanLimitExceededModal, blockExternalSourceRecordVisibility } = useEeConfig()

const isOptionsOpen = ref(false)
const isBasesOptionsOpen = ref<Record<string, boolean>>({})

const activeKey = ref<string[]>([])
const [searchActive] = useToggle()
const filterQuery = ref('')
const keys = ref<Record<string, number>>({})
const isTableDeleteDialogVisible = ref(false)
const isProjectDeleteDialogVisible = ref(false)

const projectNodeRef = ref()

const { refreshViewTabTitle } = useViewsStore()

// If only base is open, i.e in case of docs, base view is open and not the page view
const baseViewOpen = computed(() => {
  const routeNameSplit = String(route.value?.name).split('baseId-index-index')
  if (routeNameSplit.length <= 1) return false

  const routeNameAfterProjectView = routeNameSplit[routeNameSplit.length - 1]
  return routeNameAfterProjectView.split('-').length === 2 || routeNameAfterProjectView.split('-').length === 1
})

const showBaseOption = (source: SourceType) => {
  return ['airtableImport', 'csvImport', 'jsonImport', 'excelImport'].some((permission) => isUIAllowed(permission, { source }))
}

const enableEditMode = () => {
  if (!isUIAllowed('baseRename')) return

  editMode.value = true
  tempTitle.value = base.value.title!
  nextTick(() => {
    input.value?.focus()
    input.value?.select()
    // input.value?.scrollIntoView()
  })
}

const enableEditModeForSource = (sourceId: string) => {
  if (!isUIAllowed('baseRename')) return

  const source = base.value.sources?.find((s) => s.id === sourceId)
  if (!source?.id) return

  sourceRenameHelpers.value[source.id] = {
    editMode: true,
    tempTitle: source.alias || '',
  }

  nextTick(() => {
    const input: HTMLInputElement | null = document.querySelector(`[data-source-rename-input-id="${sourceId}"]`)
    if (!input) return
    input?.focus()
    input?.select()
    // input?.scrollIntoView()
  })
}

const updateSourceTitle = async (sourceId: string) => {
  const source = base.value.sources?.find((s) => s.id === sourceId)

  if (!source?.id || !sourceRenameHelpers.value[source.id]) return

  if (sourceRenameHelpers.value[source.id].tempTitle) {
    sourceRenameHelpers.value[source.id].tempTitle = sourceRenameHelpers.value[source.id].tempTitle.trim()
  }

  if (!sourceRenameHelpers.value[source.id].tempTitle) {
    delete sourceRenameHelpers.value[source.id]
    return
  }

  try {
    await api.source.update(source.base_id, source.id, {
      alias: sourceRenameHelpers.value[source.id].tempTitle,
    })

    await loadProject(source.base_id, true)

    delete sourceRenameHelpers.value[source.id]

    $e('a:source:rename')

    refreshViewTabTitle?.()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    refreshCommandPalette()
  }
}

const updateProjectTitle = async () => {
  if (tempTitle.value) {
    tempTitle.value = tempTitle.value.trim()
  }

  if (!tempTitle.value) {
    editMode.value = false
    tempTitle.value = ''
    return
  }

  try {
    await updateProject(base.value.id!, {
      title: tempTitle.value,
    })
    // update base title in recent views
    allRecentViews.value = allRecentViews.value.map((view) => {
      if (view.baseId === base.value.id) {
        view.baseName = tempTitle.value
      }
      return view
    })
    editMode.value = false
    tempTitle.value = ''

    $e('a:base:rename')

    refreshViewTabTitle?.()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    refreshCommandPalette()
  }
}

defineExpose({
  enableEditMode,
})

const setColor = async (color: string, base: BaseType) => {
  try {
    const meta = {
      ...parseProp(base.meta),
      iconColor: color,
    }

    basesStore.updateProject(base.id!, { meta: JSON.stringify(meta) })

    $e('a:base:icon:color:navdraw', { iconColor: color })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    refreshCommandPalette()
  }
}

/**
 * Opens a dialog to create a new table.
 *
 * @returns {void}
 *
 * @remarks
 * This function is triggered when the user initiates the table creation process.
 * It opens a dialog for table creation, handles the dialog closure,
 * and potentially scrolls to the newly created table.
 *
 * @see {@link packages/nc-gui/components/smartsheet/topbar/TableListDropdown.vue} for a similar implementation
 * of table creation dialog. If this function is updated, consider updating the other implementation as well.
 */
function openTableCreateDialog(baseIndex?: number | undefined) {
  $e('c:table:create:navdraw')

  const isOpen = ref(true)
  let sourceId = base.value!.sources?.[0].id
  if (typeof baseIndex === 'number') {
    sourceId = base.value!.sources?.[baseIndex].id
  }

  if (!sourceId || !base.value?.id) return

  const { close } = useDialog(resolveComponent('DlgTableCreate'), {
    'modelValue': isOpen,
    sourceId, // || sources.value[0].id,
    'baseId': base.value!.id,
    'onCreate': closeDialog,
    'onUpdate:modelValue': () => closeDialog(),
  })

  function closeDialog(table?: TableType) {
    isOpen.value = false

    if (!table) return

    isExpanded.value = true

    if (!activeKey.value || !activeKey.value.includes(`collapse-${sourceId}`)) {
      activeKey.value.push(`collapse-${sourceId}`)
    }

    // TODO: Better way to know when the table node dom is available
    setTimeout(() => {
      const newTableDom = document.querySelector(`[data-table-id="${table.id}"]`)
      if (!newTableDom) return

      // Scroll to the table node
      newTableDom?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 1000)

    close(1000)
  }
}

function openErdView(source: SourceType) {
  $e('c:project:relation')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgBaseErd'), {
    'modelValue': isOpen,
    'sourceId': source!.id,
    'onUpdate:modelValue': () => closeDialog(),
    'baseId': base.value!.id,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const isAddNewProjectChildEntityLoading = ref(false)
const addNewProjectChildEntity = async () => {
  if (!projectNodeRef.value) return

  projectNodeRef.value?.addNewProjectChildEntity?.()
}

// todo: temp

const onProjectClick = async (base: NcProject, ignoreNavigation?: boolean, toggleIsExpanded?: boolean) => {
  if (!base) {
    return
  }

  ignoreNavigation = isMobileMode.value || ignoreNavigation
  toggleIsExpanded = isMobileMode.value || toggleIsExpanded

  let isSharedBase = false
  // if shared base ignore navigation
  if (route.value.params.typeOrId === 'base') {
    isSharedBase = true
  }
  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  if (cmdOrCtrl && !ignoreNavigation && base.type === 'database') {
    await navigateTo(
      `${cmdOrCtrl ? '#' : ''}${baseUrl({
        id: base.id!,
        type: 'database',
        isSharedBase,
      })}`,
      cmdOrCtrl
        ? {
            open: navigateToBlankTargetOpenOption,
          }
        : undefined,
    )
    return
  }

  if (toggleIsExpanded) {
    isExpanded.value = !isExpanded.value
  } else {
    isExpanded.value = true
  }

  const isProjectPopulated = basesStore.isProjectPopulated(base.id!)

  if (!isProjectPopulated) base.isLoading = true

  // if dashboard or document base, add a document tab and route to the respective page
  switch (base.type) {
    case 'dashboard':
      $e('c:dashboard:open', base.id)
      await populateLayouts({ baseId: base.id! })
      if (!ignoreNavigation) {
        await navigateTo(dashboardProjectUrl(base.id!))
      }
      break
    case 'documentation':
      // addTab({
      //   id: base.id,
      //   title: base.title!,
      //   type: TabType.DOCUMENT,
      //   baseId: base.id,
      // })
      $e('c:document:open', base.id)
      await populatedNestedPages({ baseId: base.id! })
      if (!ignoreNavigation) {
        await navigateTo(docsProjectUrl(base.id!))
      }
      break
    case 'database':
      if (!ignoreNavigation) {
        await navigateTo(
          baseUrl({
            id: base.id!,
            type: 'database',
            isSharedBase,
          }),
        )
      }

      if (!isProjectPopulated) {
        await loadProjectTables(base.id!)
      }
      break
    default:
      throw new Error(`Unknown base type: ${base.type}`)
  }

  if (!isProjectPopulated) {
    base.isLoading = false

    const updatedProject = bases.value.get(base.id!)!
    updatedProject.isLoading = false
  }
}

// TODO - implement
/*
function openSqlEditor(source: SourceType) {
  navigateTo(`/ws/${route.params.typeOrId}/nc/${source.base_id}/sql/${source.id}`)
}

async function openProjectSqlEditor(_project: BaseType) {
  if (!_project.id) return

  if (!basesStore.isProjectPopulated(_project.id)) {
    await loadProject(_project.id)
  }

  const base = bases.value.get(_project.id)

  const source = base?.sources?.[0]
  if (!source) return
  navigateTo(`/ws/${route.params.typeOrId}/nc/${source.base_id}/sql/${source.id}`)
}
*/

const contextMenuBase = computed(() => {
  if (contextMenuTarget.type === 'base') {
    return contextMenuTarget.value
  } else if (contextMenuTarget.type === 'table') {
    const source = base.value?.sources?.find((b) => b.id === contextMenuTarget.value.source_id)
    if (source) return source
  }
  return null
})

watch(
  () => activeTable.value?.id,
  async () => {
    if (!activeTable.value) return

    const sourceId = activeTable.value.source_id
    if (!sourceId) return

    if (!activeKey.value.includes(`collapse-${sourceId}`)) {
      activeKey.value.push(`collapse-${sourceId}`)
    }
  },
  {
    immediate: true,
  },
)

onKeyStroke('Escape', () => {
  if (isOptionsOpen.value) {
    isOptionsOpen.value = false
  }

  for (const key of Object.keys(isBasesOptionsOpen.value)) {
    isBasesOptionsOpen.value[key] = false
  }
})

const isDuplicateDlgOpen = ref(false)
const selectedProjectToDuplicate = ref()

const duplicateProject = (base: BaseType) => {
  if (showRecordPlanLimitExceededModal()) return

  selectedProjectToDuplicate.value = base
  isDuplicateDlgOpen.value = true
}

const getSource = (sourceId: string) => {
  return base.value.sources?.find((s) => s.id === sourceId)
}

const labelEl = ref()
watch(
  () => labelEl.value && activeProjectId.value === base.value?.id,
  async (isActive) => {
    if (!isActive) return
    await nextTick()
    labelEl.value?.scrollIntoView({ behavior: 'smooth' })
  },
  {
    immediate: true,
  },
)

const isAutomationEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.NOCODB_SCRIPTS))

const openBaseSettings = async (baseId: string) => {
  await navigateTo(`/${route.value.params.typeOrId}/${baseId}?page=base-settings`)
}

const openBaseHomePage = async (baseId: string) => {
  await navigateTo(`/${route.value.params.typeOrId}/${baseId}`)
}

const showNodeTooltip = ref(true)

const shouldOpenContextMenu = computed(() => {
  if (isSharedBase.value || !contextMenuTarget.value) return false

  if (contextMenuTarget.type === 'table') {
    return true
  }

  // if (contextMenuTarget.type === 'base' && base.value.type === 'database') {
  //   return true
  // }

  // if (contextMenuTarget.type === 'source') {
  //   return true
  // }

  return false
})

/* Data reflection */
const { createConnectionDetails, getConnectionDetails, dataReflectionEnabled, connectionUrl } = useDataReflection()

/*
  0: Init
  1: Loading
  2: Success
  3: Error
*/
const dataReflectionState = ref(0)
const dataReflectionText = ref('Get Connection')

const onDataReflection = async () => {
  try {
    dataReflectionState.value = 1

    if (!dataReflectionEnabled.value) {
      dataReflectionText.value = 'Creating...'
      await createConnectionDetails(base.value.id)
      await copy(connectionUrl.value)
      dataReflectionState.value = 2
      dataReflectionText.value = 'Copied!'
    } else {
      dataReflectionText.value = 'Copying...'
      await getConnectionDetails(base.value.id)
      await copy(connectionUrl.value)
      dataReflectionState.value = 2
      dataReflectionText.value = 'Copied!'
    }
  } catch (e: any) {
    dataReflectionState.value = 3
    dataReflectionText.value = 'Error!'
  }

  setTimeout(() => {
    dataReflectionState.value = 0
    dataReflectionText.value = 'Get Connection'
  }, 2000)
}

const onClickMenu = (e: { key?: string }) => {
  if (e?.key === 'connect') {
    return
  }
  isOptionsOpen.value = false
}
</script>

<template>
  <div v-if="base?.id && !base.isLoading">
    <DashboardSidebarHeaderWrapper>
      <div class="flex-1">
        <DashboardTreeViewProjectNode ref="projectNodeRef" is-project-header />
      </div>
    </DashboardSidebarHeaderWrapper>
    <div>
      <div class="px-1 h-12 flex items-center">
        <NcButton
          v-e="['c:base:home']"
          type="text"
          size="xsmall"
          class="nc-sidebar-top-button !xs:hidden !h-8 w-full"
          :centered="false"
          :class="{
            '!text-brand-600 !bg-brand-50 !hover:bg-brand-50': activeProjectId === base.id && baseViewOpen,
            '!hover:(bg-gray-200 text-gray-700)': !(activeProjectId === base.id && baseViewOpen),
          }"
          @click="openBaseHomePage(base.id)"
        >
          <div
            class="flex items-center gap-2 pl-3 pr-1"
            :class="{
              'font-semibold': activeProjectId === base.id && baseViewOpen,
            }"
          >
            <GeneralIcon icon="ncHome" class="!h-4 w-4" />
            <div>Base Home</div>
          </div>
        </NcButton>
      </div>
      <div class="relative nc-scrollbar-thin">
        <div class="nc-project-home-section">
          <div class="nc-project-home-section-header">Tables</div>
          <div
            class="nc-create-table-btn flex flex-row items-center cursor-pointer rounded-md w-full text-brand-500 hover:text-brand-600"
            role="button"
            @click="addNewProjectChildEntity"
          >
            <div class="flex flex-row items-center pl-1.25 !py-1.5 text-inherit">
              <GeneralIcon icon="plus" />
              <div class="pl-1.75">
                {{
                  $t('general.createEntity', {
                    entity: $t('objects.table'),
                  })
                }}
              </div>
            </div>
          </div>
          <div key="g1" class="overflow-x-hidden transition-max-height" :class="{ 'max-h-0': !isExpanded }">
            <div v-if="base.type === 'documentation'">
              <LazyDocsSideBar v-if="isExpanded" :base="base" />
            </div>
            <div v-else-if="base.type === 'dashboard'">
              <LayoutsSideBar v-if="isExpanded" :base="base" />
            </div>
            <template v-else-if="base?.sources">
              <div class="flex-1 overflow-y-auto overflow-x-hidden flex flex-col" :class="{ 'mb-[20px]': isSharedBase }">
                <div v-if="base?.sources?.[0]?.enabled" class="flex-1">
                  <div class="transition-height duration-200">
                    <DashboardTreeViewTableList :base="base" :source-index="0" />
                  </div>
                </div>

                <div v-if="base?.sources?.slice(1).filter((el) => el.enabled)?.length" class="transition-height duration-200">
                  <div class="border-none sortable-list">
                    <div v-for="(source, baseIndex) of base.sources" :key="`source-${source.id}`">
                      <template v-if="baseIndex === 0"></template>
                      <a-collapse
                        v-else-if="source && source.enabled"
                        v-model:activeKey="activeKey"
                        class="!mx-0 !px-0"
                        :class="[{ hidden: searchActive && !!filterQuery }]"
                        expand-icon-position="right"
                        :bordered="false"
                        ghost
                      >
                        <template #expandIcon="{ isActive, header }">
                          <NcButton
                            v-if="
                              !(
                                header?.[0]?.props?.['data-sourceId'] &&
                                sourceRenameHelpers[header?.[0]?.props?.['data-sourceId']]?.editMode
                              )
                            "
                            v-e="['c:external:base:expand']"
                            type="text"
                            size="xxsmall"
                            class="nc-sidebar-node-btn nc-sidebar-expand !xs:opacity-100"
                            :class="{ '!opacity-100 !inline-block': isBasesOptionsOpen[source!.id!] }"
                          >
                            <GeneralIcon
                              icon="chevronDown"
                              class="flex-none cursor-pointer transform transition-transform duration-500 rotate-270"
                              :class="{ '!rotate-360': isActive }"
                            />
                          </NcButton>
                        </template>
                        <a-collapse-panel :key="`collapse-${source.id}`">
                          <template #header>
                            <div
                              :data-sourceId="source.id"
                              class="nc-sidebar-node min-w-20 w-full h-full flex flex-row group py-0.5 !ml-0"
                              :class="{
                                'pr-0.5': source.id && sourceRenameHelpers[source.id]?.editMode,
                                'pr-6.5': !(source.id && sourceRenameHelpers[source.id]?.editMode),
                              }"
                            >
                              <div
                                v-if="baseIndex === 0"
                                class="source-context flex items-center gap-2 text-gray-800 nc-sidebar-node-title"
                                @contextmenu="setMenuContext('source', source)"
                              >
                                <GeneralBaseLogo class="flex-none min-w-4 !xs:(min-w-4.25 w-4.25 text-sm)" />
                                Default
                              </div>
                              <div
                                v-else
                                class="source-context flex flex-grow items-center gap-1 text-gray-800 min-w-1/20 max-w-full"
                                @contextmenu="setMenuContext('source', source)"
                              >
                                <NcTooltip
                                  :tooltip-style="{ 'min-width': 'max-content' }"
                                  :overlay-inner-style="{ 'min-width': 'max-content' }"
                                  :mouse-leave-delay="0.3"
                                  placement="topLeft"
                                  trigger="hover"
                                >
                                  <template #title>
                                    <component :is="getSourceTooltip(source)" />
                                  </template>
                                  <div class="flex-none w-6 flex items-center justify-center">
                                    <GeneralBaseLogo
                                      :color="getSourceIconColor(source)"
                                      class="flex-none min-w-4 !xs:(min-w-4.25 w-4.25 text-sm)"
                                    />
                                  </div>
                                </NcTooltip>

                                <a-input
                                  v-if="source.id && sourceRenameHelpers[source.id]?.editMode"
                                  ref="input"
                                  v-model:value="sourceRenameHelpers[source.id].tempTitle"
                                  class="capitalize !bg-transparent flex-1 mr-4 !pr-1.5 !text-gray-700 !rounded-md !h-6 animate-sidebar-node-input-padding"
                                  :style="{
                                    fontWeight: 'inherit',
                                  }"
                                  :data-source-rename-input-id="source.id"
                                  @click.stop
                                  @keydown.enter.stop.prevent
                                  @keyup.enter="updateSourceTitle(source.id!)"
                                  @keyup.esc="updateSourceTitle(source.id!)"
                                  @blur="updateSourceTitle(source.id!)"
                                  @keydown.stop
                                />
                                <NcTooltip
                                  v-else
                                  class="nc-sidebar-node-title capitalize text-ellipsis overflow-hidden select-none text-gray-700"
                                  :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
                                  show-on-truncate-only
                                >
                                  <template #title> {{ source.alias || '' }}</template>
                                  <span
                                    :data-testid="`nc-sidebar-base-${source.alias}`"
                                    @dblclick.stop="enableEditModeForSource(source.id!)"
                                  >
                                    {{ source.alias || '' }}
                                  </span>
                                </NcTooltip>
                                <LazyPaymentUpgradeBadge
                                  v-if="
                                    blockExternalSourceRecordVisibility(true) &&
                                    !(source.id && sourceRenameHelpers[source.id]?.editMode)
                                  "
                                  :title="$t('upgrade.upgradeToSeeMoreRecord')"
                                  :content="$t('upgrade.upgradeToSeeMoreRecordSubtitle')"
                                  class="-my-1 mx-0.5 nc-sidebar-node-btn nc-sidebar-upgrade-badge"
                                  :class="{
                                'nc-sidebar-option-open': isBasesOptionsOpen[source!.id!]
                              }"
                                />
                              </div>
                              <div
                                v-if="!(source.id && sourceRenameHelpers[source.id]?.editMode)"
                                class="flex flex-row items-center gap-x-0.25"
                              >
                                <NcDropdown
                                  :visible="isBasesOptionsOpen[source!.id!]"
                                  :trigger="['click']"
                                  @update:visible="isBasesOptionsOpen[source!.id!] = $event"
                                >
                                  <NcButton
                                    class="nc-sidebar-node-btn"
                                    :class="{ '!text-black !opacity-100 !inline-block': isBasesOptionsOpen[source!.id!] }"
                                    type="text"
                                    size="xxsmall"
                                    @click.stop="isBasesOptionsOpen[source!.id!] = !isBasesOptionsOpen[source!.id!]"
                                  >
                                    <GeneralIcon icon="threeDotHorizontal" class="text-xl w-4.75" />
                                  </NcButton>
                                  <template #overlay>
                                    <NcMenu
                                      class="nc-scrollbar-md !min-w-50"
                                      :style="{
                                        maxHeight: '70vh',
                                        overflow: 'overlay',
                                      }"
                                      variant="small"
                                      @click="isBasesOptionsOpen[source!.id!] = false"
                                    >
                                      <NcMenuItem
                                        v-if="isUIAllowed('baseRename')"
                                        data-testid="nc-sidebar-source-rename"
                                        @click="enableEditModeForSource(source.id!)"
                                      >
                                        <GeneralIcon icon="rename" />
                                        {{ $t('general.rename') }}
                                      </NcMenuItem>

                                      <NcDivider />

                                      <!-- ERD View -->
                                      <NcMenuItem key="erd" @click="openErdView(source)">
                                        <GeneralIcon icon="ncErd" />
                                        Relations
                                      </NcMenuItem>

                                      <DashboardTreeViewBaseOptions
                                        v-if="showBaseOption(source)"
                                        v-model:base="base"
                                        :source="source"
                                      />
                                    </NcMenu>
                                  </template>
                                </NcDropdown>

                                <NcButton
                                  v-if="isUIAllowed('tableCreate', { roles: base.project_role || base.workspace_role, source })"
                                  type="text"
                                  size="xxsmall"
                                  class="nc-sidebar-node-btn"
                                  :class="{ '!opacity-100 !inline-block': isBasesOptionsOpen[source!.id!] }"
                                  @click.stop="openTableCreateDialog(baseIndex)"
                                >
                                  <GeneralIcon icon="plus" class="text-xl leading-5" style="-webkit-text-stroke: 0.15px" />
                                </NcButton>
                              </div>
                            </div>
                          </template>
                          <div
                            ref="menuRefs"
                            :key="`sortable-${source.id}-${source.id && source.id in keys ? keys[source.id] : '0'}`"
                            :nc-source="source.id"
                          >
                            <DashboardTreeViewTableList :base="base" :source-index="baseIndex" />
                          </div>
                        </a-collapse-panel>
                      </a-collapse>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
      <Automation v-if="isAutomationEnabled && !isSharedBase" :base-id="base.id" />
    </div>
  </div>
</template>

<style lang="scss">
.nc-project-home-section {
  @apply px-1 pb-3;

  .nc-project-home-section-header {
    @apply w-full px-3 py-1.5 flex items-center gap-2 h-8 text-nc-content-gray-muted text-captionBold;
  }
}
</style>
