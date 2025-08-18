<script setup lang="ts">
import type Sortable from 'sortablejs'
import { type DashboardType, ModelTypes, PlanLimitTypes, PlanTitles, type SourceType, type TableType } from 'nocodb-sdk'

const props = defineProps<{
  baseId: string
}>()

const baseId = toRef(props, 'baseId')

const { $e } = useNuxtApp()

const { api } = useApi()

const { t } = useI18n()

const { refreshCommandPalette } = useCommandPalette()

const { blockExternalSourceRecordVisibility } = useEeConfig()

const { refreshViewTabTitle } = useViewsStore()

const { isUIAllowed } = useRoles()

const bases = useBases()

const { addUndo, defineModelScope } = useUndoRedo()

const dashboardStore = useDashboardStore()

const { loadProject } = bases

const { activeTables } = storeToRefs(useTablesStore())

const { activeDashboardId, activeBaseDashboards } = storeToRefs(dashboardStore)

const { updateDashboard, openNewDashboardModal } = dashboardStore

const { setMenuContext } = inject(TreeViewInj)!

const base = inject(ProjectInj)!

let sortable: Sortable

const selected = ref<string[]>([])

const keys = ref<Record<string, number>>({})

const activeKey = ref<string[]>([])

const dragging = ref(false)

const isBasesOptionsOpen = ref<Record<string, boolean>>({})

const sourceRenameHelpers = ref<
  Record<
    string,
    {
      editMode: boolean
      tempTitle: string
    }
  >
>({})

const isMarked = ref<string | false>(false)

const allEntities = computed<Array<any>>(() => {
  const entities = []
  for (const dashboard of activeBaseDashboards.value) {
    entities.push(dashboard)
  }

  if (base.value?.sources?.length && base.value?.sources?.[0]?.enabled) {
    const sourceId = base.value?.sources?.[0]?.id
    for (const table of activeTables.value) {
      if (table.source_id !== sourceId) continue
      entities.push(table)
    }
  }

  return entities.sort((a, b) => a.order - b.order)
})

async function onRenameDashboard(dashboard: DashboardType, originalTitle?: string, undo = false) {
  try {
    await updateDashboard(dashboard.base_id, dashboard.id!, {
      title: dashboard.title,
      order: dashboard.order,
    })

    if (!undo) {
      addUndo({
        redo: {
          fn: (s: DashboardType, title: string) => {
            const tempTitle = s.title
            s.title = title
            onRenameDashboard(s, tempTitle, true)
          },
          args: [dashboard, dashboard.title],
        },
        undo: {
          fn: (s: DashboardType, title: string) => {
            const tempTitle = s.title
            s.title = title
            onRenameDashboard(s, tempTitle, true)
          },
          args: [dashboard, originalTitle],
        },
        scope: defineModelScope({ base_id: dashboard.base_id }),
      })
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const updateDashboardIcon = async (icon: string, dashboard: DashboardType) => {
  try {
    // modify the icon property in meta
    dashboard.meta = {
      ...parseProp(dashboard.meta),
      icon,
    }

    await updateDashboard(dashboard.base_id, dashboard.id!, {
      meta: dashboard.meta,
    })

    $e('a:dashboard:icon:sidebar', { icon })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

/** Open delete modal for dashboard */
function onDeleteDashboard(dashboard: DashboardType) {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgDashboardDelete'), {
    'visible': isOpen,
    'dashboard': dashboard,
    'onUpdate:visible': closeDialog,
    'onDeleted': () => {
      closeDialog()
    },
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const duplicateDashboard = async (dashboard: DashboardType) => {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgDashboardDuplicate'), {
    'modelValue': isOpen,
    'dashboard': dashboard,
    'onUpdate:modelValue': closeDialog,
    'onDeleted': () => {
      closeDialog()
    },
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

/** validate dashboard title */
function validateDashboardTitle(dashboard: DashboardType) {
  if (!dashboard.title || dashboard.title.trim().length < 0) {
    return t('msg.error.dashboardNameRequired')
  }

  if (activeBaseDashboards.value.some((s) => s.title === dashboard.title && s.id !== dashboard.id)) {
    return t('msg.error.dashboardNameDuplicate')
  }

  return true
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

const showBaseOption = (source: SourceType) => {
  return ['airtableImport', 'csvImport', 'jsonImport', 'excelImport'].some((permission) => isUIAllowed(permission, { source }))
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
function openTableCreateDialog(baseIndex?: number | undefined, showSourceSelector = true) {
  $e('c:table:create:navdraw')

  const isOpen = ref(true)
  let sourceId = base.value!.sources?.[0].id
  if (typeof baseIndex === 'number') {
    sourceId = base.value!.sources?.[baseIndex].id
  }

  if (!sourceId || !base.value?.id) return

  const { close } = useDialog(resolveComponent('DlgTableCreate'), {
    'modelValue': isOpen,
    sourceId,
    'baseId': base.value!.id,
    'onCreate': closeDialog,
    'showSourceSelector': showSourceSelector,
    'onUpdate:modelValue': () => closeDialog(),
  })

  function closeDialog(table?: TableType) {
    isOpen.value = false

    if (!table) return

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
</script>

<template>
  <a-menu
    ref="menuRef"
    :class="{ dragging }"
    :selected-keys="selected"
    class="nc-data-menu flex flex-col w-full !border-r-0 !bg-inherit"
  >
    <template v-for="entity of allEntities" :key="entity.id">
      <DashboardTreeViewDashboardNode
        v-if="entity.type === ModelTypes.DASHBOARD"
        :id="entity.id"
        class="nc-dashboard-item !rounded-md !px-0.75 !py-0.5 w-full transition-all ease-in duration-100"
        :class="{
          'bg-gray-200': isMarked === entity.id,
          'active': activeDashboardId === entity.id,
        }"
        :on-validate="validateDashboardTitle"
        :dashboard="entity"
        @rename="onRenameDashboard(entity)"
        @delete="onDeleteDashboard(entity)"
        @select-icon="updateDashboardIcon($event, entity)"
        @duplicate="duplicateDashboard(entity)"
      />
      <DashboardTreeViewTableNode
        v-else
        class="nc-tree-item text-sm"
        :data-order="entity.order"
        :data-id="entity.id"
        :table="entity"
        :base="base!"
        :source-index="0"
        :data-title="entity.title"
        :data-type="entity.type"
      />
    </template>
    <div v-if="base?.sources?.slice(1).some((el) => el.enabled)" class="transition-height duration-200">
      <div class="border-none sortable-list">
        <div v-for="(source, baseIndex) of base.sources" :key="`source-${source.id}`">
          <template v-if="baseIndex === 0"></template>
          <a-collapse
            v-else-if="source && source.enabled"
            v-model:active-key="activeKey"
            class="!mx-0 !px-0"
            expand-icon-position="right"
            :bordered="false"
            ghost
          >
            <template #expandIcon="{ isActive, header }">
              <NcButton
                v-if="
                  !(header?.[0]?.props?.['data-sourceId'] && sourceRenameHelpers[header?.[0]?.props?.['data-sourceId']]?.editMode)
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
                      :key="source.alias"
                      class="nc-sidebar-node-title capitalize text-ellipsis overflow-hidden select-none text-gray-700"
                      :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
                      show-on-truncate-only
                    >
                      <template #title> {{ source.alias || '' }}</template>
                      <span :data-testid="`nc-sidebar-base-${source.alias}`" @dblclick.stop="enableEditModeForSource(source.id!)">
                        {{ source.alias || '' }}
                      </span>
                    </NcTooltip>
                    <LazyPaymentUpgradeBadge
                      v-if="blockExternalSourceRecordVisibility(true) && !(source.id && sourceRenameHelpers[source.id]?.editMode)"
                      :title="$t('upgrade.upgradeToSeeMoreRecord')"
                      :content="
                        $t('upgrade.upgradeToSeeMoreRecordSubtitle', {
                          plan: PlanTitles.BUSINESS,
                        })
                      "
                      class="-my-1 mx-0.5 nc-sidebar-node-btn nc-sidebar-upgrade-badge"
                      :class="{ 'nc-sidebar-option-open': isBasesOptionsOpen[source!.id!] }"
                      :plan-title="PlanTitles.BUSINESS"
                      :limit-or-feature="PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE"
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
                            :show-source-selector="false"
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
                      @click.stop="openTableCreateDialog(baseIndex, false)"
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
                <DashboardTreeViewTableList :base="base" :source-index="baseIndex" :show-create-table-btn="false" />
              </div>
            </a-collapse-panel>
          </a-collapse>
        </div>
      </div>
    </div>
  </a-menu>
</template>

<style lang="scss">
.nc-data-menu {
  .ghost,
  .ghost > * {
    @apply !pointer-events-none;
  }

  &.dragging {
    .nc-icon {
      @apply !hidden;
    }

    .nc-view-icon {
      @apply !block;
    }
  }

  .ant-menu-item:not(.sortable-chosen) {
    @apply color-transition;
  }

  .ant-menu-title-content {
    @apply !w-full;
  }

  .sortable-chosen {
    @apply !bg-gray-200;
  }

  .active {
    @apply !bg-primary-selected font-medium;
  }
}
</style>
