<script lang="ts" setup>
import { nextTick } from '@vue/runtime-core'
import { ProjectRoles, ProjectTypes, RoleColors, RoleIcons, RoleLabels, WorkspaceRolesToProjectRoles } from 'nocodb-sdk'
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

const { isSharedBase, isPrivateBase } = storeToRefs(useBase())
const { baseUrl } = useBase()

const { setMenuContext, duplicateTable, contextMenuTarget, tableRenameId } = inject(TreeViewInj)!

const { isMobileMode, user } = useGlobal()

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

const { createProject: _createProject, updateProject, toggleStarred } = basesStore

const { bases, activeProjectId, basesUser, showProjectList } = storeToRefs(basesStore)

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

const { allRecentViews } = storeToRefs(useViewsStore())

const { meta: metaKey, control } = useMagicKeys()

const editMode = ref(false)

const tempTitle = ref('')
// const { t } = useI18n()

const input = ref<HTMLInputElement>()

const { isUIAllowed } = useRoles()

const { refreshCommandPalette } = useCommandPalette()

const { $e } = useNuxtApp()

const { copy } = useCopy()

const { showRecordPlanLimitExceededModal } = useEeConfig()

const isOptionsOpen = ref(false)
const isProjectNodeContextMenuOpen = ref(false)
const isBasesOptionsOpen = ref<Record<string, boolean>>({})

const activeKey = ref<string[]>([])
const isTableDeleteDialogVisible = ref(false)
const isProjectDeleteDialogVisible = ref(false)

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

function openTableCreateDialog(baseIndex?: number | undefined, showSourceSelector = true) {
  $e('c:table:create:navdraw')

  let sourceId = base.value!.sources?.[0].id

  if (typeof baseIndex === 'number') {
    sourceId = base.value!.sources?.[baseIndex].id
  }

  _openTableCreateDialog({
    baseId: base.value?.id,
    sourceId,
    showSourceSelector,
    onCloseCallback: () => {
      isExpanded.value = true

      if (!activeKey.value || !activeKey.value.includes(`collapse-${sourceId}`)) {
        activeKey.value.push(`collapse-${sourceId}`)
      }
    },
  })
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
const addNewProjectChildEntity = async (showSourceSelector = true) => {
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
    openTableCreateDialog(undefined, showSourceSelector)
  } finally {
    isAddNewProjectChildEntityLoading.value = false
  }
}

// todo: temp

const onProjectClick = async (base: NcProject, ignoreNavigation?: boolean, toggleIsExpanded?: boolean) => {
  if (!base || isProjectHeader.value) {
    return
  }

  if (ignoreNavigation && toggleIsExpanded) {
    ignoreNavigation = false
    toggleIsExpanded = false
  }

  toggleIsExpanded = isMobileMode.value || toggleIsExpanded

  let isSharedBase = false
  // if shared base ignore navigation
  if (route.value.params.typeOrId === 'base') {
    isSharedBase = true
  }
  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  if (!cmdOrCtrl && activeProjectId.value === base.id) {
    if (!isExpanded.value) {
      isExpanded.value = true
    }

    showProjectList.value = false
    return
  }

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

  const baseType = base.type || ProjectTypes.DATABASE

  switch (baseType) {
    case ProjectTypes.DATABASE:
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
      throw new Error(`Unknown base type: ${baseType}`)
  }

  if (!isProjectPopulated) {
    base.isLoading = false

    const updatedProject = bases.value.get(base.id!)!
    updatedProject.isLoading = false
  }

  showProjectList.value = false
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

    labelEl.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  },
  {
    immediate: true,
  },
)

const openBaseSettings = async (baseId: string) => {
  await navigateTo(`/${route.value.params.typeOrId}/${baseId}?page=base-settings`)
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
    v-model:visible="isProjectNodeContextMenuOpen"
    :trigger="[isProjectHeader ? 'click' : 'contextmenu']"
    overlay-class-name="nc-dropdown-tree-view-context-menu"
    :disabled="isProjectHeader ? editMode || isSharedBase || !!isMobileMode : undefined"
  >
    <div
      ref="labelEl"
      class="nc-base-sub-menu rounded-md box-content"
      :class="{ 'active': isExpanded, 'self-start': isProjectHeader }"
      :data-testid="`nc-sidebar-base-${base.title}`"
      :data-base-id="base.id"
    >
      <NcTooltip
        :tooltip-style="{ width: '240px', zIndex: '1049' }"
        :overlay-inner-style="{ width: '240px' }"
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
            <div>
              <div class="text-[10px] leading-[14px] text-gray-300 uppercase mb-1">{{ $t('labels.projName') }}</div>
              <div class="text-small leading-[18px] mb-1">{{ base.title }}</div>
            </div>

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
            class="nc-sidebar-node base-title-node rounded-md group flex items-center"
            :class="{
              'nc-project-header': isProjectHeader,
              'text-subHeading2 gap-2 hover:bg-nc-bg-gray-medium h-8 cursor-pointer px-1 max-w-full': isProjectHeader,
              'flex-grow w-full': isProjectHeader && editMode,
              'bg-nc-bg-gray-medium': isProjectHeader && isProjectNodeContextMenuOpen,
              'h-7 pr-1 pl-2.5 xs:(pl-0) flex-grow w-full': !isProjectHeader,
              'bg-primary-selected active': activeProjectId === base.id && baseViewOpen && !isMobileMode && !isProjectHeader,
              'hover:bg-gray-200': !(activeProjectId === base.id && baseViewOpen) && !isProjectHeader,
            }"
            :data-id="base.id"
            :data-testid="`nc-sidebar-base-title-${base.title}`"
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
                activeProjectId === base.id && baseViewOpen && !isProjectHeader
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
              class="nc-sidebar-node-title capitalize text-ellipsis overflow-hidden select-none"
              :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
              :class="[
                activeProjectId === base.id && baseViewOpen && !isMobileMode && !isProjectHeader
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
                <div class="flex items-center gap-1">
                  <NcTooltip
                    v-if="isPrivateBase"
                    :title="$t('title.privateBase')"
                    @mouseenter="showNodeTooltip = false"
                    @mouseleave="showNodeTooltip = true"
                  >
                    <NcBadge
                      size="sm"
                      class="!text-bodySm !bg-transparent hover:bg-nc-bg-gray-medium group-hover:hover:!bg-nc-bg-gray-dark !font-normal !text-nc-content-gray-subtle2 !h-5 !w-5 !px-0.5"
                      rounded="md"
                      color="grey"
                      :border="false"
                    >
                      <GeneralIcon v-if="isPrivateBase" icon="ncLock" class="flex-none text-nc-content-gray-muted" />
                    </NcBadge>
                  </NcTooltip>
                  <GeneralIcon v-if="!isMobileMode" icon="chevronDown" class="flex-none text-nc-content-gray-muted" />
                </div>
              </template>
              <template v-else>
                <NcDropdown v-if="!isSharedBase" v-model:visible="isOptionsOpen" :trigger="['click']">
                  <NcButton
                    class="nc-sidebar-node-btn"
                    :class="{
                      '!text-black !opacity-100 !inline-block': isOptionsOpen,
                    }"
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
                      :data-reflection-state="dataReflectionState"
                      :data-reflection-text="dataReflectionText"
                      @click-menu="onClickMenu($event)"
                      @rename="enableEditMode()"
                      @toggle-starred="toggleStarred($event)"
                      @duplicate-project="duplicateProject($event)"
                      @open-erd-view="openErdView($event)"
                      @on-data-reflection="onDataReflection"
                      @open-base-settings="openBaseSettings($event)"
                      @delete="isProjectDeleteDialogVisible = true"
                    />
                  </template>
                </NcDropdown>

                <NcButton
                  v-if="
                    isUIAllowed('tableCreate', { roles: base.project_role || base.workspace_role, source: base?.sources?.[0] })
                  "
                  :disabled="!base?.sources?.[0]?.enabled && base?.sources?.length === 1"
                  class="nc-sidebar-node-btn"
                  type="text"
                  data-testid="nc-sidebar-add-base-entity"
                  size="xxsmall"
                  :class="{
                    '!text-black !inline-block !opacity-100': isAddNewProjectChildEntityLoading,
                    '!inline-block !opacity-100': isOptionsOpen,
                  }"
                  :loading="isAddNewProjectChildEntityLoading"
                  @click.stop="addNewProjectChildEntity()"
                  @mouseenter="showNodeTooltip = false"
                  @mouseleave="showNodeTooltip = true"
                >
                  <NcTooltip :title="$t('activity.createTable')" hide-on-click>
                    <GeneralIcon icon="plus" class="text-xl leading-5" style="-webkit-text-stroke: 0.15px" />
                  </NcTooltip>
                </NcButton>

                <NcButton
                  type="text"
                  size="xxsmall"
                  class="nc-sidebar-node-btn nc-sidebar-expand !xs:opacity-100"
                  :class="{ '!opacity-100': isOptionsOpen }"
                  @click.stop="onProjectClick(base, true, true)"
                  @mouseenter="showNodeTooltip = false"
                  @mouseleave="showNodeTooltip = true"
                >
                  <GeneralIcon
                    icon="chevronRight"
                    class="flex-none nc-sidebar-source-node-btns cursor-pointer transform transition-transform duration-200 text-[20px]"
                    :class="{ '!rotate-90': base.isExpanded }"
                  />
                </NcButton>
              </template>
            </template>
          </div>
        </div>
      </NcTooltip>
    </div>
    <template v-if="shouldOpenContextMenu || isProjectHeader" #overlay>
      <DashboardTreeViewProjectActionMenu
        v-if="isProjectHeader"
        :show-base-option="(source) => showBaseOption(source)"
        :data-reflection-state="dataReflectionState"
        :data-reflection-text="dataReflectionText"
        @click-menu="onClickMenu($event)"
        @rename="enableEditMode(true)"
        @toggle-starred="toggleStarred($event)"
        @duplicate-project="duplicateProject($event)"
        @open-erd-view="openErdView($event)"
        @on-data-reflection="onDataReflection"
        @open-base-settings="openBaseSettings($event)"
        @delete="isProjectDeleteDialogVisible = true"
      />

      <NcMenu
        v-else
        :class="{
          '!min-w-62.5': contextMenuTarget.type === 'table',
          '!min-w-50': contextMenuTarget.type !== 'table',
        }"
        variant="small"
      >
        <template v-if="contextMenuTarget.type === 'base' && base.type === 'database'">
          <!--
          <NcMenuItem v-if="isUIAllowed('sqlEditor')" @click="openProjectSqlEditor(contextMenuTarget.value)">
            <div class="nc-base-option-item">SQL Editor</div>
          </NcMenuItem>
          <NcMenuItem @click="openProjectErdView(contextMenuTarget.value)">
            <div class="nc-base-option-item">
              <GeneralIcon icon="ncErd" />
              {{ $t('title.erdView') }}
            </div>
          </NcMenuItem>
          -->
        </template>

        <template v-else-if="contextMenuTarget.type === 'source'">
          <!--
          <NcMenuItem v-if="isUIAllowed('sqlEditor')" @click="openSqlEditor(contextMenuTarget.value)">
            <div class="nc-base-option-item">SQL Editor</div>
          </NcMenuItem>

          <NcMenuItem @click="openErdView(contextMenuTarget.value)">
            <div class="nc-base-option-item">
              <GeneralIcon icon="ncErd" />
              {{ $t('title.erdView') }}
            </div>
          </NcMenuItem>
          -->
        </template>

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
              <div class="nc-base-option-item">
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
              <div class="nc-base-option-item">
                <GeneralIcon icon="duplicate" />
                {{ $t('general.duplicate') }} {{ $t('objects.table') }}
              </div>
            </NcMenuItem>
            <NcDivider />
            <NcMenuItem
              v-if="isUIAllowed('tableDelete', { source: getSource(contextMenuTarget.value?.source_id) })"
              danger
              @click="isTableDeleteDialogVisible = true"
            >
              <div class="nc-base-option-item">
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
  <DlgBaseDelete v-model:visible="isProjectDeleteDialogVisible" :base-id="base?.id" />

  <DlgBaseDuplicate v-if="selectedProjectToDuplicate" v-model="isDuplicateDlgOpen" :base="selectedProjectToDuplicate" />
</template>

<style lang="scss" scoped>
.nc-base-option-item {
  @apply flex flex-row gap-x-2 items-center;
}

.nc-sidebar-icon {
  @apply ml-0.5 mr-1;
}

:deep(.ant-collapse-header) {
  @apply !mx-0 !pl-7.5 h-7 !xs:(pl-6 h-[3rem]) !pr-0.5 !py-0 hover:bg-gray-200 xs:(hover:bg-gray-50) !rounded-md;

  .ant-collapse-arrow {
    @apply !right-1 !xs:(flex-none border-1 border-gray-200 w-6.5 h-6.5 mr-1);
  }
}

:deep(.ant-collapse-item) {
  @apply h-full;
}

:deep(.ant-collapse-header) {
  .nc-sidebar-upgrade-badge {
    @apply -mr-6;

    &.nc-sidebar-option-open {
      @apply mr-0.5;
    }
  }

  &:hover {
    .nc-sidebar-node-btn {
      &:not(.nc-sidebar-upgrade-badge) {
        @apply !opacity-100 !inline-block;
      }

      &.nc-sidebar-upgrade-badge {
        @apply mr-0.5;
      }

      &:not(.nc-sidebar-expand) {
        @apply !xs:hidden;
      }
    }
  }
}

:deep(.ant-collapse-content-box) {
  @apply !px-0 !pb-0 !pt-0.25;
}
</style>
