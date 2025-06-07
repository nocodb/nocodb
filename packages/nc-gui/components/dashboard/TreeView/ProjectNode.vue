<script lang="ts" setup>
import { nextTick } from '@vue/runtime-core'
import { ProjectRoles, RoleColors, RoleIcons, RoleLabels, WorkspaceRolesToProjectRoles } from 'nocodb-sdk'
import type { BaseType, SourceType, WorkspaceUserRoles } from 'nocodb-sdk'
import { LoadingOutlined } from '@ant-design/icons-vue'

interface Props {
  isProjectHeader?: boolean
}
const props = withDefaults(defineProps<Props>(), {})
const { isProjectHeader } = toRefs(props)

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

const { setMenuContext, duplicateTable, contextMenuTarget, tableRenameId } = inject(TreeViewInj)!

const base = inject(ProjectInj)!

const basesStore = useBases()

const { isMobileMode, user } = useGlobal()

const { api } = useApi()

const { createProject: _createProject, updateProject, getProjectMetaInfo, loadProject } = basesStore

const { bases, basesUser, showProjectList } = storeToRefs(basesStore)

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

const { loadProjectTables, openTableCreateDialog: _openTableCreateDialog } = useTablesStore()

const { activeTable } = storeToRefs(useTablesStore())

const { isUIAllowed } = useRoles()

const { meta: metaKey, control } = useMagicKeys()

const { refreshCommandPalette } = useCommandPalette()

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

const activeBaseId = ref('')

const isErdModalOpen = ref<Boolean>(false)

const { t } = useI18n()

const input = ref<HTMLInputElement>()

const baseRole = computed(() => base.value.project_role || base.value.workspace_role)

const { activeProjectId } = storeToRefs(useBases())

const { baseUrl } = useBase()

const { $e } = useNuxtApp()

const isOptionsOpen = ref(false)
const isProjectNodeContextMenuOpen = ref(false)
const isBasesOptionsOpen = ref<Record<string, boolean>>({})

const activeKey = ref<string[]>([])
const [searchActive] = useToggle()
const filterQuery = ref('')
const keys = ref<Record<string, number>>({})
const isTableDeleteDialogVisible = ref(false)
const isBaseDeleteDialogVisible = ref(false)

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

const enableEditMode = (fromProjectHeader = false) => {
  if (fromProjectHeader) {
    isProjectNodeContextMenuOpen.value = false
  }

  if (!isUIAllowed('baseRename') || isProjectNodeContextMenuOpen.value) return

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
    editMode.value = false
    tempTitle.value = ''

    $e('a:base:rename')

    refreshViewTabTitle?.()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const { copy } = useCopy(true)

const copyProjectInfo = async () => {
  try {
    if (
      await copy(
        Object.entries(await getProjectMetaInfo(base.value.id!)!)
          .map(([k, v]) => `${k}: **${v}**`)
          .join('\n'),
      )
    ) {
      // Copied to clipboard
      message.info(t('msg.info.copiedToClipboard'))
    }
  } catch (e: any) {
    console.error(e)
    message.error(e.message)
  }
}

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

function openTableCreateDialog(sourceIndex?: number | undefined) {
  let sourceId = base.value!.sources?.[0].id
  if (typeof sourceIndex === 'number') {
    sourceId = base.value!.sources?.[sourceIndex].id
  }

  _openTableCreateDialog({
    baseId: base.value?.id,
    sourceId,
    onCloseCallback: () => {
      base.value.isExpanded = true

      if (!activeKey.value || !activeKey.value.includes(`collapse-${sourceId}`)) {
        activeKey.value.push(`collapse-${sourceId}`)
      }
    },
  })
}

const isAddNewProjectChildEntityLoading = ref(false)

async function addNewProjectChildEntity() {
  if (isAddNewProjectChildEntityLoading.value) return

  isAddNewProjectChildEntityLoading.value = true

  const isProjectPopulated = basesStore.isProjectPopulated(base.value.id!)
  if (!isProjectPopulated) {
    // We do not wait for tables api, so that add new table is seamless.
    // Only con would be while saving table duplicate table name FE validation might not work
    // If the table list api takes time to load before the table name validation
    loadProjectTables(base.value.id!)
  }

  try {
    openTableCreateDialog()
  } finally {
    isAddNewProjectChildEntityLoading.value = false
  }
}

const onProjectClick = async (base: NcProject, ignoreNavigation?: boolean, toggleIsExpanded?: boolean) => {
  if (!base || isProjectHeader.value) {
    return
  }

  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  if (isNewSidebarEnabled.value && !cmdOrCtrl && activeProjectId.value === base.id) {
    showProjectList.value = false
    return
  }

  if (!toggleIsExpanded && !cmdOrCtrl) $e('c:base:open')

  ignoreNavigation = isMobileMode.value || ignoreNavigation
  toggleIsExpanded = isMobileMode.value || toggleIsExpanded

  if (cmdOrCtrl && !ignoreNavigation) {
    await navigateTo(
      `${cmdOrCtrl ? '#' : ''}${baseUrl({
        id: base.id!,
        type: 'database',
        isSharedBase: isSharedBase.value,
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
    base.isExpanded = !base.isExpanded
  } else {
    base.isExpanded = true
  }

  const isProjectPopulated = basesStore.isProjectPopulated(base.id!)

  if (!isProjectPopulated) base.isLoading = true

  if (!ignoreNavigation) {
    await navigateTo(
      baseUrl({
        id: base.id!,
        type: 'database',
        isSharedBase: isSharedBase.value,
      }),
    )
  }

  if (!isProjectPopulated) {
    await loadProjectTables(base.id!)
  }

  if (!isProjectPopulated) {
    base.isLoading = false

    const updatedProject = bases.value.get(base.id!)!
    updatedProject.isLoading = false
  }

  showProjectList.value = false
}

function openErdView(source: SourceType) {
  $e('c:project:relation')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgBaseErd'), {
    'modelValue': isOpen,
    'sourceId': source!.id,
    'onUpdate:modelValue': () => closeDialog(),
    'baseId': base.value.id,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const contextMenuBase = computed(() => {
  if (contextMenuTarget.type === 'source') {
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

  if (isProjectNodeContextMenuOpen.value) {
    isProjectNodeContextMenuOpen.value = false
  }

  for (const key of Object.keys(isBasesOptionsOpen.value)) {
    isBasesOptionsOpen.value[key] = false
  }
})

const isDuplicateDlgOpen = ref(false)
const selectedProjectToDuplicate = ref()

const duplicateProject = (base: BaseType) => {
  selectedProjectToDuplicate.value = base
  isDuplicateDlgOpen.value = true
}

const tableDelete = () => {
  isTableDeleteDialogVisible.value = true
  $e('c:table:delete')
}

const projectDelete = () => {
  isBaseDeleteDialogVisible.value = true
  $e('c:project:delete')
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
    labelEl.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  },
  {
    immediate: true,
  },
)

const openBaseSettings = async (baseId: string) => {
  await navigateTo(`/nc/${baseId}?page=base-settings`)
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

const onClickMenu = () => {
  isOptionsOpen.value = false
  isProjectNodeContextMenuOpen.value = false
}

defineExpose({
  enableEditMode,
  addNewProjectChildEntity,
  isAddNewProjectChildEntityLoading,
})
</script>

<template>
  <NcDropdown
    :trigger="[isProjectHeader ? 'click' : 'contextmenu']"
    overlay-class-name="nc-dropdown-tree-view-context-menu"
    :disabled="isProjectHeader ? editMode || isSharedBase || !!isMobileMode : undefined"
  >
    <div
      ref="labelEl"
      class="nc-base-sub-menu rounded-md"
      :class="{ 'active': base.isExpanded, 'ml-1 mr-0.5': !isProjectHeader && !isNewSidebarEnabled }"
      :data-testid="`nc-sidebar-base-${base.title}`"
      :data-base-id="base.id"
    >
      <NcTooltip
        :tooltip-style="{ width: '300px', zIndex: '1049' }"
        :overlay-inner-style="{ width: '300px' }"
        trigger="hover"
        :placement="isProjectHeader ? 'rightTop' : 'right'"
        hide-on-click
        :disabled="
          editMode ||
          isOptionsOpen ||
          isAddNewProjectChildEntityLoading ||
          !showNodeTooltip ||
          !collaborators.length ||
          isProjectNodeContextMenuOpen ||
          !!isMobileMode
        "
      >
        <template #title>
          <div class="flex flex-col gap-3">
            <div class="text-small leading-[18px] mb-1">{{ base.title }}</div>
            <div v-if="currentUserRole">
              <div class="text-[10px] leading-[14px] text-gray-300 uppercase mb-1">{{ $t('title.yourBaseRole') }}</div>
              <div
                class="text-xs font-medium flex items-start gap-2 flex items-center gap-1"
                :class="{
                  'text-purple-200': RoleColors[currentUserRole] === 'purple',
                  'text-blue-200': RoleColors[currentUserRole] === 'blue',
                  'text-green-200': RoleColors[currentUserRole] === 'green',
                  'text-orange-200': RoleColors[currentUserRole] === 'orange',
                  'text-yellow-200': RoleColors[currentUserRole] === 'yellow',
                  'text-red-200': RoleColors[currentUserRole] === 'red',
                  'text-maroon-200': RoleColors[currentUserRole] === 'maroon',
                }"
              >
                <GeneralIcon :icon="RoleIcons[currentUserRole]" class="w-4 h-4" />
                {{ $t(`objects.roleType.${RoleLabels[currentUserRole]}`) }}
              </div>
            </div>
          </div>
        </template>
        <div
          class="flex items-center gap-0.75"
          :class="{
            'py-0.5 cursor-pointer': !isProjectHeader,
          }"
          @contextmenu="setMenuContext('base', base)"
        >
          <div
            ref="baseNodeRefs"
            :class="{
              'text-subHeading2 gap-2 hover:bg-nc-bg-gray-medium h-8 cursor-pointer px-1 max-w-full': isProjectHeader,
              'flex-grow w-full': isProjectHeader && editMode,
              'bg-nc-bg-gray-medium': isProjectHeader && isProjectNodeContextMenuOpen,
              'h-7 pr-1 pl-2.5 xs:(pl-0) flex-grow w-full': !isProjectHeader,
              'bg-primary-selected active':
                activeProjectId === base.id && (baseViewOpen || isNewSidebarEnabled) && !isMobileMode && !isProjectHeader,
              'hover:bg-gray-200': !(activeProjectId === base.id && (baseViewOpen || isNewSidebarEnabled)) && !isProjectHeader,
            }"
            :data-id="base.id"
            :data-testid="`nc-sidebar-base-title-${base.title}`"
            class="nc-sidebar-node base-title-node flex-grow rounded-md group flex items-center w-full"
          >
            <div
              class="flex items-center"
              :class="{
                'mr-1': !isProjectHeader,
              }"
              @click="onProjectClick(base)"
              @mouseenter="showNodeTooltip = false"
              @mouseleave="showNodeTooltip = true"
            >
              <div class="flex items-center select-none w-6 h-full">
                <a-spin v-if="base.isLoading" class="!ml-1.25 !flex !flex-row !items-center !my-0.5 w-8" :indicator="indicator" />

                <div v-else>
                  <GeneralBaseIconColorPicker
                    :key="`${base.id}_${parseProp(base.meta).iconColor}`"
                    :type="base?.type"
                    :model-value="parseProp(base.meta).iconColor"
                    size="small"
                    :icon-class="isProjectHeader ? 'h-6 w-6' : ''"
                    :readonly="
                      (base?.type && base?.type !== 'database') || !isUIAllowed('baseRename') || isProjectNodeContextMenuOpen
                    "
                    @update:model-value="setColor($event, base)"
                  >
                  </GeneralBaseIconColorPicker>
                </div>
              </div>
            </div>

            <a-input
              v-if="editMode"
              ref="input"
              v-model:value="tempTitle"
              class="capitalize !bg-transparent !flex-1 mr-4 !rounded-md !pr-1.5 !h-6 animate-sidebar-node-input-padding"
              :class="
                activeProjectId === base.id && (baseViewOpen || isNewSidebarEnabled) && !isProjectHeader
                  ? '!text-brand-600 !font-semibold'
                  : '!text-gray-700'
              "
              :style="{
                fontWeight: 'inherit',
              }"
              @click.stop
              @keyup.enter="updateProjectTitle"
              @keyup.esc="updateProjectTitle"
              @blur="updateProjectTitle"
              @keydown.stop
            />
            <NcTooltip
              v-else
              :disabled="!!collaborators.length"
              class="nc-sidebar-node-title capitalize text-ellipsis overflow-hidden select-none flex-1"
              :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
              :class="[
                activeProjectId === base.id && (baseViewOpen || isNewSidebarEnabled) && !isProjectHeader
                  ? 'text-brand-600 font-semibold'
                  : 'text-gray-700',
                {
                  'flex-1': !isProjectHeader,
                },
              ]"
              show-on-truncate-only
              @click="onProjectClick(base)"
            >
              <template #title>{{ base.title }}</template>
              <span @dblclick.stop="enableEditMode()">
                {{ base.title }}
              </span>
            </NcTooltip>

            <template v-if="!editMode">
              <template v-if="isProjectHeader">
                <GeneralIcon v-if="!isMobileMode" icon="chevronDown" class="flex-none text-nc-content-gray-muted" />
              </template>
              <template v-else>
                <NcDropdown v-if="!isSharedBase" v-model:visible="isOptionsOpen" :trigger="['click']">
                  <NcButton
                    v-e="['c:base:options']"
                    class="nc-sidebar-node-btn"
                    :class="{ '!text-black !opacity-100 !inline-block': isOptionsOpen }"
                    data-testid="nc-sidebar-context-menu"
                    type="text"
                    :size="isProjectHeader ? 'small' : 'xxsmall'"
                    @click.stop
                    @mouseenter="showNodeTooltip = false"
                    @mouseleave="showNodeTooltip = true"
                  >
                    <GeneralIcon
                      :icon="isProjectHeader ? 'threeDotVertical' : 'threeDotHorizontal'"
                      class="text-xl w-4.75"
                      :class="{
                        'text-nc-content-gray-subtle': isProjectHeader,
                      }"
                    />
                  </NcButton>
                  <template #overlay>
                    <DashboardTreeViewProjectActionMenu
                      :show-base-option="(source) => showBaseOption(source)"
                      @click-menu="onClickMenu"
                      @rename="enableEditMode()"
                      @duplicate-project="duplicateProject($event)"
                      @copy-project-info="copyProjectInfo()"
                      @open-erd-view="openErdView($event)"
                      @open-base-settings="openBaseSettings($event)"
                      @delete="projectDelete"
                    />
                  </template>
                </NcDropdown>

                <NcButton
                  v-if="isUIAllowed('tableCreate', { roles: baseRole, source: base?.sources?.[0] })"
                  v-e="['c:base:create-table']"
                  :disabled="!base?.sources?.[0]?.enabled"
                  class="nc-sidebar-node-btn"
                  size="xxsmall"
                  type="text"
                  data-testid="nc-sidebar-add-base-entity"
                  :class="{
                    '!text-black !inline-block !opacity-100': isAddNewProjectChildEntityLoading,
                    '!inline-block !opacity-100': isOptionsOpen,
                  }"
                  :loading="isAddNewProjectChildEntityLoading"
                  @click.stop="addNewProjectChildEntity"
                  @mouseenter="showNodeTooltip = false"
                  @mouseleave="showNodeTooltip = true"
                >
                  <NcTooltip :title="$t('activity.createTable')" :disabled="!isNewSidebarEnabled" hide-on-click>
                    <GeneralIcon icon="plus" class="text-xl leading-5" style="-webkit-text-stroke: 0.15px" />
                  </NcTooltip>
                </NcButton>

                <NcButton
                  v-e="['c:base:expand']"
                  type="text"
                  size="xxsmall"
                  class="nc-sidebar-node-btn nc-sidebar-expand !xs:opacity-100 !mr-0 mt-0.5"
                  :class="{
                    '!opacity-100': isOptionsOpen,
                  }"
                  @click="onProjectClick(base, true, true)"
                  @mouseenter="showNodeTooltip = false"
                  @mouseleave="showNodeTooltip = true"
                >
                  <GeneralIcon
                    icon="chevronRight"
                    class="group-hover:visible cursor-pointer transform transition-transform duration-200 text-[20px]"
                    :class="{ '!rotate-90': base.isExpanded && !isNewSidebarEnabled }"
                  />
                </NcButton>
              </template>
            </template>
          </div>
        </div>
      </NcTooltip>

      <div
        v-if="base.id && !base.isLoading && !isNewSidebarEnabled"
        key="g1"
        class="overflow-x-hidden transition-max-height"
        :class="{ 'max-h-0': !base.isExpanded }"
      >
        <template v-if="base && base?.sources">
          <div class="flex-1 overflow-y-auto overflow-x-hidden flex flex-col" :class="{ 'mb-[20px]': isSharedBase }">
            <div v-if="base?.sources?.[0]?.enabled" class="flex-1">
              <div class="transition-height duration-200">
                <DashboardTreeViewTableList :base="base" :source-index="0" />
              </div>
            </div>

            <div v-if="base?.sources?.slice(1).some((el) => el.enabled)" class="transition-height duration-200">
              <div class="border-none sortable-list">
                <div v-for="(source, sourceIndex) of base.sources" :key="`source-${source.id}`">
                  <template v-if="sourceIndex === 0"></template>
                  <a-collapse
                    v-else-if="source && source.enabled"
                    v-model:activeKey="activeKey"
                    v-e="['c:source:toggle-expand']"
                    class="!mx-0 !px-0 nc-sidebar-source-node"
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
                        class="nc-sidebar-node-btn nc-sidebar-expand !xs:opacity-100 !mr-0 mt-0.5"
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
                          class="nc-sidebar-node min-w-20 w-full h-full flex flex-row group py-0.5 !mr-0"
                          :class="{
                            'pr-0.5': source.id && sourceRenameHelpers[source.id]?.editMode,
                            'pr-6.5': !(source.id && sourceRenameHelpers[source.id]?.editMode),
                          }"
                        >
                          <div
                            v-if="sourceIndex === 0"
                            class="source-context flex items-center gap-2 text-gray-800 nc-sidebar-node-title"
                            @contextmenu="setMenuContext('source', source)"
                          >
                            <GeneralBaseLogo class="flex-none min-w-4 !xs:(min-w-4.25 w-4.25 text-sm)" />
                            {{ $t('general.default') }}
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
                              class="flex items-center"
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
                                v-e="['c:source:options']"
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
                                    <div v-e="['c:source:erd']" class="flex gap-2 items-center">
                                      <GeneralIcon icon="ncErd" />
                                      {{ $t('title.relations') }}
                                    </div>
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
                              v-if="isUIAllowed('tableCreate', { roles: baseRole, source })"
                              v-e="['c:source:add-table']"
                              type="text"
                              size="xxsmall"
                              class="nc-sidebar-node-btn"
                              :class="{ '!opacity-100 !inline-block': isBasesOptionsOpen[source!.id!] }"
                              @click.stop="openTableCreateDialog(sourceIndex)"
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
                        <DashboardTreeViewTableList :base="base" :source-index="sourceIndex" />
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
    <template v-if="shouldOpenContextMenu || isProjectHeader" #overlay>
      <DashboardTreeViewProjectActionMenu
        v-if="isProjectHeader"
        :show-base-option="(source) => showBaseOption(source)"
        @click-menu="onClickMenu"
        @rename="enableEditMode(true)"
        @duplicate-project="duplicateProject($event)"
        @copy-project-info="copyProjectInfo()"
        @open-erd-view="openErdView($event)"
        @open-base-settings="openBaseSettings($event)"
        @delete="projectDelete"
      />
      <NcMenu
        v-else
        class="!py-0 rounded text-sm"
        :class="{
          '!min-w-62.5': contextMenuTarget.type === 'table',
          '!min-w-50': contextMenuTarget.type !== 'table',
        }"
        variant="small"
      >
        <template v-if="contextMenuTarget.type === 'base' && base.type === 'database'"></template>

        <template v-else-if="contextMenuTarget.type === 'source'"></template>

        <template v-else-if="contextMenuTarget.type === 'table'">
          <NcMenuItemCopyId
            v-if="contextMenuTarget.value"
            :id="contextMenuTarget.value.id"
            :tooltip="$t('labels.clickToCopyTableID')"
            :label="
              $t('labels.tableIdColon', {
                tableId: contextMenuTarget.value?.id,
              })
            "
          />

          <template
            v-if="
              isUIAllowed('tableRename', { source: getSource(contextMenuTarget.value?.source_id) }) ||
              isUIAllowed('tableDelete', { source: getSource(contextMenuTarget.value?.source_id) })
            "
          >
            <NcDivider />
            <NcMenuItem
              v-if="isUIAllowed('tableRename', { source: getSource(contextMenuTarget.value?.source_id) })"
              @click="tableRenameId = `${contextMenuTarget.value?.id}:${contextMenuTarget.value?.source_id}`"
            >
              <div v-e="['c:table:rename']" class="nc-base-option-item flex gap-2 items-center">
                <GeneralIcon icon="rename" />
                {{ $t('general.rename') }} {{ $t('objects.table') }}
              </div>
            </NcMenuItem>

            <NcMenuItem
              v-if="
                isUIAllowed('tableDuplicate', { source: getSource(contextMenuTarget.value?.source_id) }) &&
                (contextMenuBase?.is_meta || contextMenuBase?.is_local)
              "
              @click="duplicateTable(contextMenuTarget.value)"
            >
              <div v-e="['c:table:duplicate']" class="nc-base-option-item flex gap-2 items-center">
                <GeneralIcon icon="duplicate" />
                {{ $t('general.duplicate') }} {{ $t('objects.table') }}
              </div>
            </NcMenuItem>
            <NcDivider />
            <NcMenuItem
              v-if="isUIAllowed('tableDelete', { source: getSource(contextMenuTarget.value?.source_id) })"
              class="!hover:bg-red-50"
              @click="tableDelete"
            >
              <div class="nc-base-option-item flex gap-2 items-center text-red-600">
                <GeneralIcon icon="delete" />
                {{ $t('general.delete') }} {{ $t('objects.table') }}
              </div>
            </NcMenuItem>
          </template>
        </template>
      </NcMenu>
    </template>
  </NcDropdown>
  <DlgTableDelete
    v-if="contextMenuTarget.value?.id && base?.id"
    v-model:visible="isTableDeleteDialogVisible"
    :table-id="contextMenuTarget.value?.id"
    :base-id="base?.id"
  />
  <DlgBaseDelete v-model:visible="isBaseDeleteDialogVisible" :base-id="base?.id" />
  <DlgBaseDuplicate v-if="selectedProjectToDuplicate" v-model="isDuplicateDlgOpen" :base="selectedProjectToDuplicate" />
  <GeneralModal v-model:visible="isErdModalOpen" size="large">
    <div class="h-[80vh]">
      <LazyDashboardSettingsErd :base-id="base?.id" :source-id="activeBaseId" />
    </div>
  </GeneralModal>
</template>

<style lang="scss" scoped>
:deep(.ant-collapse-header) {
  @apply !mx-0 !pl-7.5 h-7 !xs:(pl-6 h-[3rem]) !pr-0.5 !py-0 hover:bg-gray-200 xs:(hover:bg-gray-50) !rounded-md;

  .ant-collapse-arrow {
    @apply !right-1 !xs:(flex-none border-1 border-gray-200 w-6.5 h-6.5 mr-1);
  }
}

:deep(.ant-collapse-item) {
  @apply h-full;
}

:deep(.ant-collapse-content-box) {
  @apply !px-0 !pb-0 !pt-0.25;
}

:deep(.ant-collapse-header:hover) {
  .nc-sidebar-node-btn {
    @apply !opacity-100 !inline-block;

    &:not(.nc-sidebar-expand) {
      @apply !xs:hidden;
    }
  }
}
</style>
