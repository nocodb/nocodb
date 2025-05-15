<script lang="ts" setup>
import type { SourceType, TableType } from 'nocodb-sdk'

const router = useRouter()
const route = router.currentRoute

const { isSharedBase } = storeToRefs(useBase())
const { baseUrl } = useBase()

const { setMenuContext } = inject(TreeViewInj)!

const { api } = useApi()

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

const { loadProject } = basesStore

const { activeProjectId } = storeToRefs(basesStore)

const { loadProjectTables } = useTablesStore()

const { activeTable } = storeToRefs(useTablesStore())

const { isUIAllowed } = useRoles()

useTabs()

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

const input = ref<HTMLInputElement>()

const baseRole = computed(() => base.value.project_role || base.value.workspace_role)

const { $e } = useNuxtApp()

const isBasesOptionsOpen = ref<Record<string, boolean>>({})

const activeKey = ref<string[]>([])
const [searchActive] = useToggle()
const filterQuery = ref('')
const keys = ref<Record<string, number>>({})

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

    isExpanded.value = true

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

async function addNewProjectChildEntity() {
  if (!projectNodeRef.value) return

  projectNodeRef.value?.addNewProjectChildEntity?.()
}

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
  for (const key of Object.keys(isBasesOptionsOpen.value)) {
    isBasesOptionsOpen.value[key] = false
  }
})

const openBaseHomePage = async () => {
  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  await navigateTo(
    `${cmdOrCtrl ? '#' : ''}${baseUrl({
      id: base.value.id!,
      type: 'database',
      isSharedBase: isSharedBase.value,
    })}`,
    cmdOrCtrl
      ? {
          open: navigateToBlankTargetOpenOption,
        }
      : undefined,
  )
}
</script>

<template>
  <div v-if="base?.id && !base.isLoading" class="nc-treeview-active-base">
    <div>
      <DashboardSidebarHeaderWrapper>
        <div v-if="isSharedBase" class="flex-1">
          <div
            data-testid="nc-workspace-menu"
            class="flex items-center nc-workspace-menu overflow-hidden py-1.25 pr-0.25 justify-center w-full"
          >
            <a
              class="w-24 min-w-10 transition-all duration-200 p-1 transform"
              href="https://github.com/nocodb/nocodb"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img alt="NocoDB" src="~/assets/img/brand/nocodb.png" />
            </a>

            <div class="flex flex-grow"></div>
          </div>
        </div>
        <DashboardTreeViewProjectNode v-else ref="projectNodeRef" is-project-header />
      </DashboardSidebarHeaderWrapper>

      <DashboardTreeViewProjectHomeSearchInput :placeholder="`Search table, view${showCreateNewAsDropdown ? ', script' : ''}`" />

      <div class="nc-project-home-section pt-1 !pb-2 xs:hidden flex flex-col gap-2">
        <div
          v-if="isUIAllowed('tableCreate', { roles: base.project_role, source: base?.sources?.[0] })"
          class="flex items-center w-full"
        >
          <NcButton
            type="text"
            size="small"
            full-width
            class="nc-home-create-new-btn !text-brand-500 !hover:(text-brand-600) !xs:hidden w-full !px-3"
            @click="addNewProjectChildEntity"
          >
            <div class="flex items-center gap-2">
              <GeneralIcon icon="ncPlusCircleSolid" />

              {{
                $t('general.createEntity', {
                  entity: $t('objects.table'),
                })
              }}
            </div>
          </NcButton>
        </div>
        <NcButton
          v-e="['c:base:home']"
          type="text"
          size="xsmall"
          class="nc-sidebar-top-button !h-8 w-full"
          :centered="false"
          :class="{
            '!text-brand-600 !bg-brand-50 !hover:bg-brand-50': activeProjectId === base.id && baseViewOpen,
            '!hover:(bg-gray-200 text-gray-700)': !(activeProjectId === base.id && baseViewOpen),
          }"
          @click="openBaseHomePage"
        >
          <div
            class="flex items-center gap-2 pl-3 pr-1"
            :class="{
              'font-semibold': activeProjectId === base.id && baseViewOpen,
            }"
          >
            <GeneralIcon icon="home1" class="!h-4 w-4" />
            <div>Overview</div>
          </div>
        </NcButton>
      </div>
    </div>

    <div class="flex-1 relative overflow-y-auto nc-scrollbar-thin">
      <div class="nc-project-home-section">
        <div class="nc-project-home-section-header !cursor-pointer" @click.stop="isExpanded = !isExpanded">
          <div class="flex-1">Tables</div>

          <GeneralIcon
            icon="chevronRight"
            class="flex-none nc-sidebar-source-node-btns cursor-pointer transform transition-transform duration-200 text-[20px] text-nc-content-gray-muted"
            :class="{ '!rotate-90': isExpanded }"
          />
        </div>
        <div key="g1" class="overflow-x-hidden transition-max-height" :class="{ 'max-h-0': !isExpanded }">
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
    </div>

    <slot name="footer"> </slot>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-collapse-header) {
  @apply !mx-0 !pl-2 h-7 !xs:(pl-2 h-[3rem]) !pr-0.5 !py-0 hover:bg-gray-200 xs:(hover:bg-gray-50) !rounded-md;

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

:deep(.nc-home-create-new-btn.nc-button) {
  @apply hover:bg-brand-50 !pr-1.5;

  &.active {
    @apply !bg-brand-50;
  }
}
</style>
