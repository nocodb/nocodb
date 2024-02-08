<script lang="ts" setup>
import { nextTick } from '@vue/runtime-core'
import { message } from 'ant-design-vue'
import type { BaseType, SourceType, TableType } from 'nocodb-sdk'
import { LoadingOutlined } from '@ant-design/icons-vue'
import { useTitle } from '@vueuse/core'
import type { NcProject } from '#imports'
import {
  NcProjectType,
  ProjectInj,
  ProjectRoleInj,
  ToggleDialogInj,
  extractSdkResponseErrorMsg,
  openLink,
  storeToRefs,
  useBases,
} from '#imports'
import { useNuxtApp } from '#app'

const indicator = h(LoadingOutlined, {
  class: '!text-gray-400',
  style: {
    fontSize: '0.85rem',
  },
  spin: true,
})

const router = useRouter()
const route = router.currentRoute

const { isSharedBase } = storeToRefs(useBase())
const { baseUrl } = useBase()

const { setMenuContext, openRenameTableDialog, duplicateTable, contextMenuTarget } = inject(TreeViewInj)!

const { isMobileMode } = useGlobal()

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

const { bases, activeProjectId } = storeToRefs(basesStore)

const { loadProjectTables } = useTablesStore()

const { activeTable } = storeToRefs(useTablesStore())

const { allRecentViews } = storeToRefs(useViewsStore())

const { appInfo } = useGlobal()

useTabs()

const editMode = ref(false)

const tempTitle = ref('')

// const { t } = useI18n()

const input = ref<HTMLInputElement>()

const { isUIAllowed } = useRoles()

const baseRole = inject(ProjectRoleInj)

const toggleDialog = inject(ToggleDialogInj, () => {})

const { refreshCommandPalette } = useCommandPalette()

const { addNewLayout, getDashboardProjectUrl: dashboardProjectUrl, populateLayouts } = useDashboardStore()

const { addNewPage, populatedNestedPages, baseUrl: docsProjectUrl } = useDocStore()

const { $e } = useNuxtApp()

const isOptionsOpen = ref(false)
const isBasesOptionsOpen = ref<Record<string, boolean>>({})

const activeKey = ref<string[]>([])
const [searchActive] = useToggle()
const filterQuery = ref('')
const keys = ref<Record<string, number>>({})
const isTableDeleteDialogVisible = ref(false)
const isProjectDeleteDialogVisible = ref(false)

// If only base is open, i.e in case of docs, base view is open and not the page view
const baseViewOpen = computed(() => {
  const routeNameSplit = String(route.value?.name).split('baseId-index-index')
  if (routeNameSplit.length <= 1) return false

  const routeNameAfterProjectView = routeNameSplit[routeNameSplit.length - 1]
  return routeNameAfterProjectView.split('-').length === 2 || routeNameAfterProjectView.split('-').length === 1
})

const showBaseOption = computed(() => {
  return ['airtableImport', 'csvImport', 'jsonImport', 'excelImport'].some((permission) =>
    isUIAllowed(permission, false, baseRole!.value),
  )
})

const enableEditMode = () => {
  editMode.value = true
  tempTitle.value = base.value.title!
  nextTick(() => {
    input.value?.focus()
    input.value?.select()
    input.value?.scrollIntoView()
  })
}

const updateProjectTitle = async () => {
  if (!tempTitle.value) return

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

    useTitle(`${base.value?.title}`)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    refreshCommandPalette()
  }
}

defineExpose({
  enableEditMode,
})

const setIcon = async (icon: string, base: BaseType) => {
  try {
    const meta = {
      ...((base.meta as object) || {}),
      icon,
    }

    basesStore.updateProject(base.id!, { meta: JSON.stringify(meta) })

    $e('a:base:icon:navdraw', { icon })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

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

  const { close } = useDialog(resolveComponent('DlgProjectErd'), {
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
  if (isAddNewProjectChildEntityLoading.value) return

  isAddNewProjectChildEntityLoading.value = true

  const isProjectPopulated = basesStore.isProjectPopulated(base.value.id!)
  if (!isProjectPopulated && base.value.type === NcProjectType.DB) {
    // We do not wait for tables api, so that add new table is seamless.
    // Only con would be while saving table duplicate table name FE validation might not work
    // If the table list api takes time to load before the table name validation
    loadProjectTables(base.value.id!)
  }

  try {
    switch (base.value.type) {
      case NcProjectType.DASHBOARD:
        await populateLayouts({ baseId: base.value.id! })
        await addNewLayout({ baseId: base.value!.id! })
        break
      case NcProjectType.DOCS:
        await populatedNestedPages({ baseId: base.value.id! })
        await addNewPage({ parentPageId: undefined, baseId: base.value!.id! })
        break
      case NcProjectType.DB:
        openTableCreateDialog()
        break
    }

    if (!isExpanded.value && base.value.type !== NcProjectType.DB) {
      isExpanded.value = true
    }
  } finally {
    isAddNewProjectChildEntityLoading.value = false
  }
}

// todo: temp

const onProjectClick = async (base: NcProject, ignoreNavigation?: boolean, toggleIsExpanded?: boolean) => {
  if (!base) {
    return
  }

  ignoreNavigation = isMobileMode.value || ignoreNavigation
  toggleIsExpanded = isMobileMode.value || toggleIsExpanded

  if (toggleIsExpanded) {
    isExpanded.value = !isExpanded.value
  } else {
    isExpanded.value = true
  }

  const isProjectPopulated = basesStore.isProjectPopulated(base.id!)

  let isSharedBase = false
  // if shared base ignore navigation
  if (route.value.params.typeOrId === 'base') {
    isSharedBase = true
  }

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
  selectedProjectToDuplicate.value = base
  isDuplicateDlgOpen.value = true
}
</script>

<template>
  <a-dropdown :trigger="['contextmenu']" overlay-class-name="nc-dropdown-tree-view-context-menu">
    <div
      class="ml-1 mr-0.5 nc-base-sub-menu rounded-md"
      :class="{ active: isExpanded }"
      :data-testid="`nc-sidebar-base-${base.title}`"
      :data-base-id="base.id"
    >
      <div class="flex items-center gap-0.75 py-0.25 cursor-pointer" @contextmenu="setMenuContext('base', base)">
        <div
          :class="{
            'bg-primary-selected active': activeProjectId === base.id && baseViewOpen && !isMobileMode,
            'hover:bg-gray-200': !(activeProjectId === base.id && baseViewOpen),
          }"
          :data-testid="`nc-sidebar-base-title-${base.title}`"
          class="nc-sidebar-node base-title-node h-7.25 flex-grow rounded-md group flex items-center w-full pr-1"
        >
          <NcButton
            type="text"
            size="xxsmall"
            class="nc-sidebar-node-btn nc-sidebar-expand ml-0.75 !xs:visible"
            @click.stop="onProjectClick(base, true, true)"
          >
            <GeneralIcon
              icon="triangleFill"
              class="group-hover:visible cursor-pointer transform transition-transform duration-500 h-1.5 w-1.75 rotate-90 !xs:visible"
              :class="{ '!rotate-180': base.isExpanded, '!visible': isOptionsOpen }"
            />
          </NcButton>
          <div class="flex items-center mr-1" @click="onProjectClick(base)">
            <div class="flex items-center select-none w-6 h-full">
              <a-spin v-if="base.isLoading" class="!ml-1.25 !flex !flex-row !items-center !my-0.5 w-8" :indicator="indicator" />

              <LazyGeneralEmojiPicker
                v-else
                :key="base.meta?.icon"
                :emoji="base.meta?.icon"
                :readonly="true"
                size="small"
                @emoji-selected="setIcon($event, base)"
              >
                <template #default>
                  <GeneralProjectIcon :type="base.type" />
                </template>
              </LazyGeneralEmojiPicker>
            </div>
          </div>

          <input
            v-if="editMode"
            ref="input"
            v-model="tempTitle"
            class="flex-grow leading-1 outline-0 ring-none capitalize !text-inherit !bg-transparent w-4/5"
            :class="{ 'text-black font-semibold': activeProjectId === base.id && baseViewOpen }"
            @click.stop
            @keyup.enter="updateProjectTitle"
            @keyup.esc="updateProjectTitle"
            @blur="updateProjectTitle"
          />
          <span
            v-else
            class="nc-sidebar-node-title capitalize text-ellipsis overflow-hidden select-none"
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
            :class="{ 'text-black font-semibold': activeProjectId === base.id && baseViewOpen && !isMobileMode }"
            @click="onProjectClick(base)"
          >
            {{ base.title }}
          </span>
          <div :class="{ 'flex flex-grow h-full': !editMode }" @click="onProjectClick(base)"></div>

          <NcDropdown v-if="!isSharedBase" v-model:visible="isOptionsOpen" :trigger="['click']">
            <NcButton
              class="nc-sidebar-node-btn"
              :class="{ '!text-black !opacity-100': isOptionsOpen }"
              data-testid="nc-sidebar-context-menu"
              type="text"
              size="xxsmall"
              @click.stop
            >
              <GeneralIcon icon="threeDotHorizontal" class="text-xl w-4.75" />
            </NcButton>

            <template #overlay>
              <NcMenu
                class="nc-scrollbar-md min-w-42"
                :style="{
                  maxHeight: '70vh',
                  overflow: 'overlay',
                }"
                :data-testid="`nc-sidebar-base-${base.title}-options`"
                @click="isOptionsOpen = false"
              >
                <NcMenuItem v-if="isUIAllowed('baseRename')" data-testid="nc-sidebar-base-rename" @click="enableEditMode">
                  <GeneralIcon icon="rename" class="group-hover:text-black" />
                  {{ $t('general.rename') }}
                </NcMenuItem>

                <NcMenuItem data-testid="nc-sidebar-base-starred" @click="() => toggleStarred(base.id)">
                  <GeneralIcon v-if="base.starred" icon="unStar" class="group-hover:text-black" />
                  <GeneralIcon v-else icon="star" class="group-hover:text-black" />
                  <div class="ml-0.25">
                    {{ base.starred ? 'Remove from starred' : 'Add to Starred' }}
                  </div>
                </NcMenuItem>

                <NcMenuItem
                  v-if="
                    base.type === NcProjectType.DB &&
                    isUIAllowed('baseDuplicate', { roles: [base.workspace_role, base.project_role].join() })
                  "
                  data-testid="nc-sidebar-base-duplicate"
                  @click="duplicateProject(base)"
                >
                  <GeneralIcon icon="duplicate" class="text-gray-700" />
                  {{ $t('general.duplicate') }}
                </NcMenuItem>

                <NcDivider />

                <!-- ERD View -->
                <NcMenuItem key="erd" data-testid="nc-sidebar-base-relations" @click="openErdView(base?.sources?.[0]!)">
                  <GeneralIcon icon="erd" />
                  Relations
                </NcMenuItem>

                <!-- Swagger: Rest APIs -->
                <NcMenuItem
                  v-if="isUIAllowed('apiDocs')"
                  key="api"
                  v-e="['e:api-docs']"
                  class="group"
                  data-testid="nc-sidebar-base-rest-apis"
                  @click.stop="openLink(`/api/v2/meta/bases/${base.id}/swagger`, appInfo.ncSiteUrl)"
                >
                  <GeneralIcon icon="snippet" class="group-hover:text-black !max-w-3.9" />
                  {{ $t('labels.restApis') }}
                </NcMenuItem>

                <DashboardTreeViewBaseOptions
                  v-if="base.sources && base.sources[0] && showBaseOption"
                  v-model:base="base"
                  :source="base.sources[0]"
                />

                <NcDivider v-if="['settings', 'baseDelete'].some((permission) => isUIAllowed(permission))" />

                <NcMenuItem
                  v-if="isUIAllowed('baseMiscSettings')"
                  key="teamAndSettings"
                  v-e="['c:navdraw:base-settings']"
                  data-testid="nc-sidebar-base-settings"
                  class="nc-sidebar-base-base-settings"
                  @click="toggleDialog(true, 'teamAndAuth', undefined, base.id)"
                >
                  <GeneralIcon icon="settings" class="group-hover:text-black" />
                  {{ $t('activity.settings') }}
                </NcMenuItem>

                <NcMenuItem
                  v-if="isUIAllowed('baseDelete', { roles: [base.workspace_role, base.project_role].join() })"
                  class="!text-red-500 !hover:bg-red-50"
                  data-testid="nc-sidebar-base-delete"
                  @click="isProjectDeleteDialogVisible = true"
                >
                  <GeneralIcon icon="delete" class="w-4" />
                  <div>
                    {{ $t('general.delete') }}
                  </div>
                </NcMenuItem>
              </NcMenu>
            </template>
          </NcDropdown>

          <NcButton
            v-if="isUIAllowed('tableCreate', { roles: baseRole })"
            class="nc-sidebar-node-btn"
            type="text"
            data-testid="nc-sidebar-add-base-entity"
            size="xxsmall"
            :class="{ '!text-black !visible': isAddNewProjectChildEntityLoading, '!visible': isOptionsOpen }"
            :loading="isAddNewProjectChildEntityLoading"
            @click.stop="addNewProjectChildEntity"
          >
            <GeneralIcon icon="plus" class="text-xl leading-5" style="-webkit-text-stroke: 0.15px" />
          </NcButton>
        </div>
      </div>

      <div
        v-if="base.id && !base.isLoading"
        key="g1"
        class="overflow-x-hidden transition-max-height"
        :class="{ 'max-h-0': !isExpanded }"
      >
        <div v-if="base.type === 'documentation'">
          <LazyDocsSideBar v-if="isExpanded" :base="base" />
        </div>
        <div v-else-if="base.type === 'dashboard'">
          <LayoutsSideBar v-if="isExpanded" :base="base" />
        </div>
        <template v-else-if="base && base?.sources">
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
                    expand-icon-position="left"
                    :bordered="false"
                    ghost
                  >
                    <template #expandIcon="{ isActive }">
                      <div
                        class="nc-sidebar-expand nc-sidebar-node-btn flex flex-row items-center -mt-2 xs:(mt-3 border-1 border-gray-200 px-2.25 py-0.5 rounded-md !mr-0.25)"
                      >
                        <GeneralIcon
                          icon="triangleFill"
                          class="nc-sidebar-source-node-btns -mt-0.75 invisible xs:visible cursor-pointer transform transition-transform duration-500 h-1.5 w-1.5 text-gray-500 rotate-90"
                          :class="{ '!rotate-180': isActive }"
                        />
                      </div>
                    </template>
                    <a-collapse-panel :key="`collapse-${source.id}`">
                      <template #header>
                        <div class="nc-sidebar-node min-w-20 w-full flex flex-row group py-0.25">
                          <div
                            v-if="baseIndex === 0"
                            class="source-context flex items-center gap-2 text-gray-800 nc-sidebar-node-title"
                            @contextmenu="setMenuContext('source', source)"
                          >
                            <GeneralBaseLogo class="min-w-4 !xs:(min-w-4.25 w-4.25 text-sm)" />
                            Default
                          </div>
                          <div
                            v-else
                            class="source-context flex flex-grow items-center gap-1.75 text-gray-800 min-w-1/20 max-w-full"
                            @contextmenu="setMenuContext('source', source)"
                          >
                            <GeneralBaseLogo class="min-w-4 !xs:(min-w-4.25 w-4.25 text-sm)" />
                            <div
                              :data-testid="`nc-sidebar-base-${source.alias}`"
                              class="nc-sidebar-node-title flex capitalize text-ellipsis overflow-hidden select-none"
                              :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
                            >
                              {{ source.alias || '' }}
                            </div>
                            <a-tooltip class="xs:(hidden)">
                              <template #title>External DB - {{ source.type?.toLocaleUpperCase() }}</template>
                              <div>
                                <GeneralIcon icon="info" class="text-gray-400 -mt-0.5 hover:text-gray-700 mr-1" />
                              </div>
                            </a-tooltip>
                          </div>
                          <div class="flex flex-row items-center gap-x-0.25 w-12.25">
                            <NcDropdown
                              :visible="isBasesOptionsOpen[source!.id!]"
                              :trigger="['click']"
                              @update:visible="isBasesOptionsOpen[source!.id!] = $event"
                            >
                              <NcButton
                                class="nc-sidebar-node-btn"
                                :class="{ '!text-black !opacity-100': isBasesOptionsOpen[source!.id!] }"
                                type="text"
                                size="xxsmall"
                                @click.stop="isBasesOptionsOpen[source!.id!] = !isBasesOptionsOpen[source!.id!]"
                              >
                                <GeneralIcon icon="threeDotHorizontal" class="text-xl w-4.75" />
                              </NcButton>
                              <template #overlay>
                                <NcMenu
                                  class="nc-scrollbar-md"
                                  :style="{
                                    maxHeight: '70vh',
                                    overflow: 'overlay',
                                  }"
                                  @click="isBasesOptionsOpen[source!.id!] = false"
                                >
                                  <!-- ERD View -->
                                  <NcMenuItem key="erd" @click="openErdView(source)">
                                    <GeneralIcon icon="erd" />
                                    Relations
                                  </NcMenuItem>

                                  <DashboardTreeViewBaseOptions v-if="showBaseOption" v-model:base="base" :source="source" />
                                </NcMenu>
                              </template>
                            </NcDropdown>

                            <NcButton
                              v-if="isUIAllowed('tableCreate', { roles: baseRole })"
                              type="text"
                              size="xxsmall"
                              class="nc-sidebar-node-btn"
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
    <template v-if="!isSharedBase" #overlay>
      <NcMenu class="!py-0 rounded text-sm">
        <template v-if="contextMenuTarget.type === 'base' && base.type === 'database'">
          <!--
          <NcMenuItem v-if="isUIAllowed('sqlEditor')" @click="openProjectSqlEditor(contextMenuTarget.value)">
            <div class="nc-base-option-item">SQL Editor</div>
          </NcMenuItem>
          <NcMenuItem @click="openProjectErdView(contextMenuTarget.value)">
            <div class="nc-base-option-item">
              <GeneralIcon icon="erd" />
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
              <GeneralIcon icon="erd" />
              {{ $t('title.erdView') }}
            </div>
          </NcMenuItem>
          -->
        </template>

        <template v-else-if="contextMenuTarget.type === 'table'">
          <NcMenuItem v-if="isUIAllowed('tableRename')" @click="openRenameTableDialog(contextMenuTarget.value, true)">
            <div class="nc-base-option-item">
              <GeneralIcon icon="rename" class="text-gray-700" />
              {{ $t('general.rename') }}
            </div>
          </NcMenuItem>

          <NcMenuItem
            v-if="isUIAllowed('tableDuplicate') && (contextMenuBase?.is_meta || contextMenuBase?.is_local)"
            @click="duplicateTable(contextMenuTarget.value)"
          >
            <div class="nc-base-option-item">
              <GeneralIcon icon="duplicate" class="text-gray-700" />
              {{ $t('general.duplicate') }}
            </div>
          </NcMenuItem>

          <NcMenuItem v-if="isUIAllowed('tableDelete')" @click="isTableDeleteDialogVisible = true">
            <div class="nc-base-option-item text-red-600">
              <GeneralIcon icon="delete" />
              {{ $t('general.delete') }}
            </div>
          </NcMenuItem>
        </template>
      </NcMenu>
    </template>
  </a-dropdown>
  <DlgTableDelete
    v-if="contextMenuTarget.value?.id && base?.id"
    v-model:visible="isTableDeleteDialogVisible"
    :table-id="contextMenuTarget.value?.id"
    :base-id="base?.id"
  />
  <DlgProjectDelete v-model:visible="isProjectDeleteDialogVisible" :base-id="base?.id" />

  <DlgProjectDuplicate v-if="selectedProjectToDuplicate" v-model="isDuplicateDlgOpen" :base="selectedProjectToDuplicate" />
</template>

<style lang="scss" scoped>
.nc-base-option-item {
  @apply flex flex-row gap-x-2 items-center;
}
.nc-sidebar-icon {
  @apply ml-0.5 mr-1;
}
:deep(.ant-collapse-header) {
  @apply !mx-0 !pl-8.75 !xs:(pl-8) !pr-0.5 !py-0.5 hover:bg-gray-200 xs:(hover:bg-gray-50 ) !rounded-md;
}

:deep(.ant-collapse-item) {
  @apply h-full;
}

:deep(.ant-collapse-header:hover .nc-sidebar-source-node-btns) {
  @apply visible;
}

:deep(.ant-collapse-content-box) {
  @apply !px-0 !pb-0 !pt-0.25;
}
</style>
