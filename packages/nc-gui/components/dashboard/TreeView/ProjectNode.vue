<script lang="ts" setup>
import { nextTick } from '@vue/runtime-core'
import { message } from 'ant-design-vue'
import { stringifyRolesObj } from 'nocodb-sdk'
import type { BaseType, SourceType, TableType } from 'nocodb-sdk'
import { LoadingOutlined } from '@ant-design/icons-vue'
import { useTitle } from '@vueuse/core'
import {
  NcProjectType,
  ProjectInj,
  ProjectRoleInj,
  ToggleDialogInj,
  TreeViewInj,
  computed,
  extractSdkResponseErrorMsg,
  h,
  inject,
  navigateTo,
  openLink,
  ref,
  resolveComponent,
  storeToRefs,
  useBase,
  useBases,
  useCopy,
  useDialog,
  useGlobal,
  useI18n,
  useNuxtApp,
  useRoles,
  useRouter,
  useTablesStore,
  useTabs,
  useToggle,
} from '#imports'
import type { NcProject } from '#imports'

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

const { setMenuContext, openRenameTableDialog, duplicateTable, contextMenuTarget } = inject(TreeViewInj)!

const base = inject(ProjectInj)!

const basesStore = useBases()

const { isMobileMode } = useGlobal()

const { createProject: _createProject, updateProject, getProjectMetaInfo } = basesStore

const { bases } = storeToRefs(basesStore)

const { loadProjectTables } = useTablesStore()

const { activeTable } = storeToRefs(useTablesStore())

const { appInfo } = useGlobal()

const { orgRoles, isUIAllowed } = useRoles()

useTabs()

const editMode = ref(false)

const tempTitle = ref('')

const activeBaseId = ref('')

const isErdModalOpen = ref<boolean>(false)

const { t } = useI18n()

const input = ref<HTMLInputElement>()

const baseRole = inject(ProjectRoleInj)

const { activeProjectId } = storeToRefs(useBases())

const { baseUrl } = useBase()

const toggleDialog = inject(ToggleDialogInj, () => {})

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
  return ['airtableImport', 'csvImport', 'jsonImport', 'excelImport'].some((permission) => isUIAllowed(permission))
})

function enableEditMode() {
  editMode.value = true
  tempTitle.value = base.value.title!
  nextTick(() => {
    input.value?.focus()
    input.value?.select()
    input.value?.scrollIntoView()
  })
}

async function updateProjectTitle() {
  if (!tempTitle.value) return

  try {
    await updateProject(base.value.id!, {
      title: tempTitle.value,
    })
    editMode.value = false
    tempTitle.value = ''

    $e('a:base:rename')

    useTitle(`${base.value?.title}`)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const { copy } = useCopy(true)

async function copyProjectInfo() {
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

defineExpose({
  enableEditMode,
})

async function setIcon(icon: string, base: BaseType) {
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

function openTableCreateDialog(sourceIndex?: number | undefined) {
  const isOpen = ref(true)
  let sourceId = base.value!.sources?.[0].id
  if (typeof sourceIndex === 'number') {
    sourceId = base.value!.sources?.[sourceIndex].id
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

    base.value.isExpanded = true

    if (!activeKey.value || !activeKey.value.includes(`collapse-${sourceId}`)) {
      activeKey.value.push(`collapse-${sourceId}`)
    }

    // TODO: Better way to know when the table node dom is available
    setTimeout(() => {
      const newTableDom = document.querySelector(`[data-table-id="${table.id}"]`)
      if (!newTableDom) return

      newTableDom?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 1000)

    close(1000)
  }
}

const isAddNewProjectChildEntityLoading = ref(false)

async function addNewProjectChildEntity() {
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
    openTableCreateDialog()

    if (!base.value.isExpanded && base.value.type !== NcProjectType.DB) {
      base.value.isExpanded = true
    }
  } finally {
    isAddNewProjectChildEntityLoading.value = false
  }
}

async function onProjectClick(base: NcProject, ignoreNavigation?: boolean, toggleIsExpanded?: boolean) {
  if (!base) {
    return
  }

  if (!toggleIsExpanded) $e('c:base:open')

  ignoreNavigation = isMobileMode.value || ignoreNavigation
  toggleIsExpanded = isMobileMode.value || toggleIsExpanded

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
    const updatedProject = bases.value.get(base.id!)!
    updatedProject.isLoading = false
  }
}

function openErdView(source: SourceType) {
  $e('c:project:relation')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgProjectErd'), {
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

  for (const key of Object.keys(isBasesOptionsOpen.value)) {
    isBasesOptionsOpen.value[key] = false
  }
})

const isDuplicateDlgOpen = ref(false)
const selectedProjectToDuplicate = ref()

function duplicateProject(base: BaseType) {
  selectedProjectToDuplicate.value = base
  isDuplicateDlgOpen.value = true
}

function tableDelete() {
  isTableDeleteDialogVisible.value = true
  $e('c:table:delete')
}

function projectDelete() {
  isProjectDeleteDialogVisible.value = true
  $e('c:project:delete')
}
</script>

<template>
  <NcDropdown :trigger="['contextmenu']" overlay-class-name="nc-dropdown-tree-view-context-menu">
    <div
      class="mx-1 nc-base-sub-menu rounded-md"
      :class="{ active: base.isExpanded }"
      :data-testid="`nc-sidebar-base-${base.title}`"
      :data-base-id="base.id"
    >
      <div class="flex items-center gap-0.75 py-0.25 cursor-pointer" @contextmenu="setMenuContext('base', base)">
        <div
          ref="baseNodeRefs"
          :class="{
            'bg-primary-selected active': activeProjectId === base.id && baseViewOpen && !isMobileMode,
            'hover:bg-gray-200': !(activeProjectId === base.id && baseViewOpen),
          }"
          :data-testid="`nc-sidebar-base-title-${base.title}`"
          class="nc-sidebar-node base-title-node h-7.25 flex-grow rounded-md group flex items-center w-full pr-1"
        >
          <NcButton
            v-e="['c:base:expand']"
            type="text"
            size="xxsmall"
            class="nc-sidebar-node-btn nc-sidebar-expand ml-0.75 !xs:visible"
            @click="onProjectClick(base, true, true)"
          >
            <GeneralIcon
              icon="triangleFill"
              class="group-hover:visible cursor-pointer transform transition-transform duration-500 h-1.5 w-1.75 rotate-90 !xs:visible"
              :class="{ '!rotate-180': base.isExpanded, '!visible': isOptionsOpen }"
            />
          </NcButton>

          <div class="flex items-center mr-1" @click="onProjectClick(base)">
            <div v-e="['c:base:emojiSelect']" class="flex items-center select-none w-6 h-full">
              <a-spin v-if="base.isLoading" class="!ml-1.25 !flex !flex-row !items-center !my-0.5 w-8" :indicator="indicator" />

              <LazyGeneralEmojiPicker
                v-else
                :key="base.meta?.icon"
                :emoji="base.meta?.icon"
                :readonly="true"
                size="small"
                @emoji-selected="setIcon($event, base)"
              >
                <GeneralProjectIcon :type="base.type" />
              </LazyGeneralEmojiPicker>
            </div>
          </div>

          <input
            v-if="editMode"
            ref="input"
            v-model="tempTitle"
            class="flex-grow leading-1 outline-0 ring-none capitalize !text-inherit !bg-transparent w-4/5"
            :class="{ 'text-black font-semibold': activeProjectId === base.id && baseViewOpen && !isMobileMode }"
            @click.stop
            @keyup.enter="updateProjectTitle"
            @keyup.esc="updateProjectTitle"
            @blur="updateProjectTitle"
          />
          <span
            v-else
            class="nc-sidebar-node-title capitalize text-ellipsis overflow-hidden select-none"
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
            :class="{ 'text-black font-semibold': activeProjectId === base.id && baseViewOpen }"
            @click="onProjectClick(base)"
          >
            {{ base.title }}
          </span>
          <div :class="{ 'flex flex-grow h-full': !editMode }" @click="onProjectClick(base)"></div>

          <NcDropdown v-if="!isSharedBase" v-model:visible="isOptionsOpen" :trigger="['click']">
            <NcButton
              v-e="['c:base:options']"
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
                class="nc-scrollbar-md"
                :style="{
                  maxHeight: '70vh',
                  overflow: 'overlay',
                }"
                :data-testid="`nc-sidebar-base-${base.title}-options`"
                @click="isOptionsOpen = false"
              >
                <template v-if="!isSharedBase">
                  <NcMenuItem v-if="isUIAllowed('baseRename')" data-testid="nc-sidebar-project-rename" @click="enableEditMode">
                    <div v-e="['c:base:rename']" class="flex gap-2 items-center">
                      <GeneralIcon icon="edit" class="group-hover:text-black" />
                      {{ $t('general.rename') }}
                    </div>
                  </NcMenuItem>

                  <NcMenuItem
                    v-if="isUIAllowed('baseDuplicate', { roles: [stringifyRolesObj(orgRoles), baseRole].join() })"
                    data-testid="nc-sidebar-base-duplicate"
                    @click="duplicateProject(base)"
                  >
                    <div v-e="['c:base:duplicate']" class="flex gap-2 items-center">
                      <GeneralIcon icon="duplicate" class="text-gray-700" />
                      {{ $t('general.duplicate') }}
                    </div>
                  </NcMenuItem>

                  <NcDivider v-if="['baseDuplicate', 'baseRename'].some((permission) => isUIAllowed(permission))" />

                  <!-- Copy Project Info -->
                  <NcMenuItem
                    v-if="!isEeUI"
                    key="copy"
                    data-testid="nc-sidebar-base-copy-base-info"
                    @click.stop="copyProjectInfo"
                  >
                    <div v-e="['c:base:copy-proj-info']" class="flex gap-2 items-center">
                      <GeneralIcon icon="copy" class="group-hover:text-black" />
                      {{ $t('activity.account.projInfo') }}
                    </div>
                  </NcMenuItem>

                  <!-- ERD View -->
                  <NcMenuItem key="erd" data-testid="nc-sidebar-base-relations" @click="openErdView(base?.sources?.[0]!)">
                    <div v-e="['c:base:erd']" class="flex gap-2 items-center">
                      <GeneralIcon icon="erd" />
                      {{ $t('title.relations') }}
                    </div>
                  </NcMenuItem>

                  <!-- Swagger: Rest APIs -->
                  <NcMenuItem
                    v-if="isUIAllowed('apiDocs')"
                    key="api"
                    data-testid="nc-sidebar-base-rest-apis"
                    @click.stop="
                      () => {
                        $e('c:base:api-docs')
                        openLink(`/api/v2/meta/bases/${base.id}/swagger`, appInfo.ncSiteUrl)
                      }
                    "
                  >
                    <div v-e="['c:base:api-docs']" class="flex gap-2 items-center">
                      <GeneralIcon icon="snippet" class="group-hover:text-black !max-w-3.9" />
                      {{ $t('activity.account.swagger') }}
                    </div>
                  </NcMenuItem>
                </template>

                <template v-if="base.sources && base.sources[0] && showBaseOption">
                  <NcDivider />
                  <DashboardTreeViewBaseOptions v-model:base="base" :source="base.sources[0]" />
                </template>

                <NcDivider v-if="['baseMiscSettings', 'baseDelete'].some((permission) => isUIAllowed(permission))" />

                <NcMenuItem
                  v-if="isUIAllowed('baseMiscSettings')"
                  key="teamAndSettings"
                  data-testid="nc-sidebar-base-settings"
                  class="nc-sidebar-base-base-settings"
                  @click="toggleDialog(true, 'teamAndAuth', undefined, base.id)"
                >
                  <div v-e="['c:base:settings']" class="flex gap-2 items-center">
                    <GeneralIcon icon="settings" class="group-hover:text-black" />
                    {{ $t('activity.settings') }}
                  </div>
                </NcMenuItem>
                <NcMenuItem
                  v-if="isUIAllowed('baseDelete', { roles: [stringifyRolesObj(orgRoles), baseRole].join() })"
                  data-testid="nc-sidebar-base-delete"
                  class="!text-red-500 !hover:bg-red-50"
                  @click="projectDelete"
                >
                  <div class="flex gap-2 items-center">
                    <GeneralIcon icon="delete" class="w-4" />
                    {{ $t('general.delete') }}
                  </div>
                </NcMenuItem>
              </NcMenu>
            </template>
          </NcDropdown>

          <NcButton
            v-if="isUIAllowed('tableCreate', { roles: baseRole })"
            v-e="['c:base:create-table']"
            class="nc-sidebar-node-btn"
            size="xxsmall"
            type="text"
            data-testid="nc-sidebar-add-base-entity"
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
        :class="{ 'max-h-0': !base.isExpanded }"
      >
        <template v-if="base && base?.sources">
          <div class="flex-1 overflow-y-auto overflow-x-hidden flex flex-col" :class="{ 'mb-[20px]': isSharedBase }">
            <div v-if="base?.sources?.[0]?.enabled" class="flex-1">
              <div class="transition-height duration-200">
                <DashboardTreeViewTableList :base="base" :source-index="0" />
              </div>
            </div>

            <div v-if="base?.sources?.slice(1).filter((el) => el.enabled)?.length" class="transition-height duration-200">
              <div class="border-none sortable-list">
                <div v-for="(source, sourceIndex) of base.sources" :key="`source-${source.id}`">
                  <template v-if="sourceIndex === 0"></template>
                  <a-collapse
                    v-else-if="source && source.enabled"
                    v-model:activeKey="activeKey"
                    v-e="['c:source:toggle-expand']"
                    class="!mx-0 !px-0 nc-sidebar-source-node"
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
                            v-if="sourceIndex === 0"
                            class="source-context flex items-center gap-2 text-gray-800 nc-sidebar-node-title"
                            @contextmenu="setMenuContext('source', source)"
                          >
                            <GeneralBaseLogo class="min-w-4 !xs:(min-w-4.25 w-4.25 text-sm)" />
                            {{ $t('general.default') }}
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
                              <template #title>{{ $t('objects.externalDb') }}</template>
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
                                v-e="['c:source:options']"
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
                                    <div v-e="['c:source:erd']" class="flex gap-2 items-center">
                                      <GeneralIcon icon="erd" />
                                      {{ $t('title.relations') }}
                                    </div>
                                  </NcMenuItem>

                                  <DashboardTreeViewBaseOptions v-if="showBaseOption" v-model:base="base" :source="source" />
                                </NcMenu>
                              </template>
                            </NcDropdown>

                            <NcButton
                              v-if="isUIAllowed('tableCreate', { roles: baseRole })"
                              v-e="['c:source:add-table']"
                              type="text"
                              size="xxsmall"
                              class="nc-sidebar-node-btn"
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
    <template v-if="!isSharedBase" #overlay>
      <NcMenu class="!py-0 rounded text-sm">
        <template v-if="contextMenuTarget.type === 'base' && base.type === 'database'"></template>

        <template v-else-if="contextMenuTarget.type === 'source'"></template>

        <template v-else-if="contextMenuTarget.type === 'table'">
          <NcMenuItem v-if="isUIAllowed('tableRename')" @click="openRenameTableDialog(contextMenuTarget.value, true)">
            <div v-e="['c:table:rename']" class="nc-base-option-item flex gap-2 items-center">
              <GeneralIcon icon="edit" class="text-gray-700" />
              {{ $t('general.rename') }}
            </div>
          </NcMenuItem>

          <NcMenuItem
            v-if="isUIAllowed('tableDuplicate') && (contextMenuBase?.is_meta || contextMenuBase?.is_local)"
            @click="duplicateTable(contextMenuTarget.value)"
          >
            <div v-e="['c:table:duplicate']" class="nc-base-option-item flex gap-2 items-center">
              <GeneralIcon icon="duplicate" class="text-gray-700" />
              {{ $t('general.duplicate') }}
            </div>
          </NcMenuItem>
          <NcDivider />
          <NcMenuItem v-if="isUIAllowed('table-delete')" class="!hover:bg-red-50" @click="tableDelete">
            <div class="nc-base-option-item flex gap-2 items-center text-red-600">
              <GeneralIcon icon="delete" />
              {{ $t('general.delete') }}
            </div>
          </NcMenuItem>
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
  <DlgProjectDelete v-model:visible="isProjectDeleteDialogVisible" :base-id="base?.id" />
  <DlgProjectDuplicate v-if="selectedProjectToDuplicate" v-model="isDuplicateDlgOpen" :base="selectedProjectToDuplicate" />
  <GeneralModal v-model:visible="isErdModalOpen" size="large">
    <div class="h-[80vh]">
      <LazyDashboardSettingsErd :source-id="activeBaseId" />
    </div>
  </GeneralModal>
</template>

<style lang="scss" scoped>
:deep(.ant-collapse-header) {
  @apply !mx-0 !pl-8.75 !xs:(pl-8) !pr-0.5 !py-0.5 hover:bg-gray-200 xs:(hover:bg-gray-50 ) !rounded-md;
}

:deep(.ant-collapse-item) {
  @apply h-full;
}

:deep(.ant-collapse-content-box) {
  @apply !px-0 !pb-0 !pt-0.25;
}

:deep(.ant-collapse-header:hover .nc-sidebar-source-node-btns) {
  @apply visible;
}
</style>
