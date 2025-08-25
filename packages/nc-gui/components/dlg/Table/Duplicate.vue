<script setup lang="ts">
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'
import {
  type BaseType,
  type LinkToAnotherRecordType,
  ProjectRoles,
  type TableType,
  UITypes,
  type WorkspaceType,
  WorkspaceUserRoles,
} from 'nocodb-sdk'

const props = defineProps<{
  modelValue: boolean
  table: TableType
}>()

const emit = defineEmits(['update:modelValue'])

const { api } = useApi()

const dialogShow = useVModel(props, 'modelValue', emit)

const { $e, $poller } = useNuxtApp()

const basesStore = useBases()

const { createProject: _createProject, loadProjects } = basesStore

const { openTable } = useTablesStore()

const baseStore = useBase()

const { loadTables } = baseStore

const { base: activeBase } = storeToRefs(baseStore)

const { tables } = storeToRefs(baseStore)

const { getMeta } = useMetas()

const { t } = useI18n()

const { activeTable: _activeTable } = storeToRefs(useTablesStore())

const { refreshCommandPalette } = useCommandPalette()

const { workspacesList, activeWorkspace } = useWorkspace()

const { getFeature } = useEeConfig()

// #region target base
const wsDropdownOpen = ref(false)
const baseDropdownOpen = ref(false)
const targetWorkspace = ref(activeWorkspace)
const targetBase = ref(activeBase.value)

const targetTableMeta = computedAsync(async () => {
  return getMeta(props.table.id!)
})

const canTargetOtherBase = computed(() => {
  if (!targetTableMeta.value || (targetTableMeta.value.columns?.length ?? 0) === 0) return false
  return isEeUI && !targetTableMeta.value.columns?.some((col) => [UITypes.Links, UITypes.LinkToAnotherRecord].includes(col.uidt!))
})

const isTargetOtherWsSufficientPlan = computed(() => {
  return getFeature(PlanFeatureTypes.FEATURE_DUPLICATE_TABLE_TO_OTHER_WS)
})

const workspaceOptions = computed(() => {
  if (!isEeUI || !activeWorkspace) return []
  if (!isTargetOtherWsSufficientPlan.value) return [activeWorkspace]

  return workspacesList.filter((ws) =>
    [WorkspaceUserRoles.CREATOR, WorkspaceUserRoles.OWNER].includes(ws.roles as WorkspaceUserRoles),
  )
})

const isTargetOtherBaseSufficientPlan = computed(() => {
  return getFeature(PlanFeatureTypes.FEATURE_DUPLICATE_TABLE_TO_OTHER_BASE)
})

const targetBases: Ref<BaseType[]> = ref([])

const refreshTargetBases = async () => {
  if (!isEeUI || !targetWorkspace.value) {
    targetBases.value = []
    return
  }
  if (!isTargetOtherBaseSufficientPlan.value) {
    targetBases.value = [activeBase.value]
    return
  }
  const bases = await loadProjects(undefined, targetWorkspace.value.id)
  targetBases.value.splice(0)
  targetBases.value.push(
    ...((bases as any[])?.filter(
      (base) =>
        [WorkspaceUserRoles.CREATOR, WorkspaceUserRoles.OWNER].includes(targetWorkspace.value!.roles as WorkspaceUserRoles) ||
        [ProjectRoles.OWNER, ProjectRoles.CREATOR].includes(base.project_role),
    ) ?? []),
  )
}

const selectWorkspace = async (option: WorkspaceType) => {
  if (option.id !== targetWorkspace.value?.id) {
    targetBase.value = null as any
  }
  targetWorkspace.value = option
  wsDropdownOpen.value = false
  await refreshTargetBases()
  targetBase.value = targetBases.value?.[0] as any
}

const selectBase = (option: BaseType) => {
  targetBase.value = option
  baseDropdownOpen.value = false
}
// #endregion taget base

const options = ref({
  includeData: true,
  includeViews: true,
  includeHooks: true,
})

const optionsToExclude = computed(() => {
  const { includeData, includeViews, includeHooks } = options.value
  return {
    excludeData: !includeData,
    excludeViews: !includeViews,
    excludeHooks: !includeHooks,
  }
})

const isLoading = ref(false)

const _duplicate = async () => {
  try {
    isLoading.value = true
    const isContextDifferent = targetBase.value && targetBase.value.id !== activeBase.value.id
    const jobData = await api.dbTable.duplicate(props.table.base_id!, props.table.id!, {
      options: {
        ...optionsToExclude.value,
        ...(isContextDifferent ? { targetWorkspaceId: targetWorkspace.value!.id, targetBaseId: targetBase.value.id } : {}),
      },
    })

    $poller.subscribe(
      { id: jobData.id },
      async (data: {
        id: string
        status?: string
        data?: {
          error?: {
            message: string
          }
          message?: string
          result?: any
        }
      }) => {
        if (data.status !== 'close') {
          if (data.status === JobStatus.COMPLETED) {
            const sourceTable = await getMeta(props.table.id!)
            if (sourceTable) {
              for (const col of sourceTable.columns || []) {
                if ([UITypes.Links, UITypes.LinkToAnotherRecord].includes(col.uidt as UITypes)) {
                  if (col && col.colOptions) {
                    const relatedTableId = (col.colOptions as LinkToAnotherRecordType)?.fk_related_model_id
                    if (relatedTableId) {
                      await getMeta(relatedTableId, true)
                    }
                  }
                }
              }
            }

            if (!isContextDifferent) {
              await loadTables()
              refreshCommandPalette()
              const newTable = tables.value.find((el) => el.id === data?.data?.result?.id)

              openTable(newTable!)
            } else {
              // TODO: navigating to specified base?
              message.success(t(`msg.success.tableDuplicatedInOtherBase`))
            }
            isLoading.value = false
            dialogShow.value = false
          } else if (data.status === JobStatus.FAILED) {
            message.error(t('msg.error.failedToDuplicateTable'))
            await loadTables()
            isLoading.value = false
            dialogShow.value = false
          }
        }
      },
    )

    $e('a:table:duplicate')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    isLoading.value = false
    dialogShow.value = false
  }
}

onKeyStroke('Enter', () => {
  // should only trigger this when our modal is open
  if (dialogShow.value) {
    _duplicate()
  }
})

watch(isTargetOtherBaseSufficientPlan, (newValue) => {
  if (newValue) {
    refreshTargetBases()
  }
})

const isEaster = ref(false)

onMounted(() => {
  refreshTargetBases()
})
</script>

<template>
  <GeneralModal
    v-model:visible="dialogShow"
    :class="{ active: dialogShow }"
    :mask-closable="!isLoading"
    :keyboard="!isLoading"
    centered
    wrap-class-name="nc-modal-table-duplicate"
    :mask-style="{
      'background-color': 'rgba(0, 0, 0, 0.08)',
    }"
    :footer="null"
    class="!w-[30rem]"
    @keydown.esc="dialogShow = false"
  >
    <div>
      <div class="text-base text-nc-content-gray-emphasis leading-6 font-bold self-center" @dblclick="isEaster = !isEaster">
        {{ $t('general.duplicate') }} {{ $t('objects.table') }} "{{ table.title }}"
      </div>

      <div class="mt-5 flex gap-3 flex-col">
        <div class="flex">
          <div
            class="flex gap-3 cursor-pointer leading-5 text-nc-content-gray font-medium items-center"
            @click="options.includeData = !options.includeData"
          >
            <NcSwitch :checked="options.includeData" />
            {{ $t('labels.includeRecords') }}
          </div>
        </div>
        <div class="flex">
          <div
            class="flex gap-3 cursor-pointer leading-5 text-nc-content-gray font-medium items-center"
            @click="options.includeViews = !options.includeViews"
          >
            <NcSwitch :checked="options.includeViews" />
            {{ $t('labels.includeView') }}
          </div>
        </div>

        <div v-show="isEaster" class="flex">
          <div
            class="flex gap-3 cursor-pointer leading-5 text-nc-content-gray font-medium items-center"
            @click="options.includeHooks = !options.includeHooks"
          >
            <NcSwitch :checked="options.includeHooks" />
            {{ $t('labels.includeWebhook') }}
          </div>
        </div>
      </div>

      <div v-if="isEeUI" class="mb-5">
        <NcDivider divider-class="!my-5" />

        <div v-if="isTargetOtherWsSufficientPlan" class="text-nc-content-gray font-medium leading-5 mb-2">
          {{ $t('labels.workspace') }}
          <div class="flex items-center content-center gap-2">
            <NcTooltip :disabled="canTargetOtherBase" class="mt-2 flex-1">
              <template v-if="!canTargetOtherBase" #title>
                <span> This table contains linked records that reference data in the current base. </span>
              </template>
              <NcListDropdown v-model:is-open="wsDropdownOpen" :disabled="!canTargetOtherBase" default-slot-wrapper-class="gap-2">
                <GeneralWorkspaceIcon size="small" :workspace="targetWorkspace!" />

                <div class="flex-1 capitalize truncate">
                  {{ targetWorkspace?.title }}
                </div>

                <div class="flex gap-2 items-center">
                  <div v-if="activeWorkspace?.id === targetWorkspace?.id" class="text-nc-content-gray-muted leading-4.5 text-xs">
                    {{ $t('labels.currentWorkspace') }}
                  </div>
                  <GeneralIcon
                    :class="{
                      'transform rotate-180': wsDropdownOpen,
                    }"
                    class="transition-all w-4 h-4 opacity-80"
                    icon="ncChevronDown"
                  />
                </div>

                <template #overlay="{ onEsc }">
                  <NcList
                    v-model:open="wsDropdownOpen"
                    :value="targetWorkspace?.id ?? ''"
                    :item-height="32"
                    close-on-select
                    class="nc-base-workspace-selection w-full"
                    :min-items-for-search="6"
                    container-class-name="w-full"
                    :list="workspaceOptions"
                    option-label-key="title"
                    option-value-key="id"
                    stop-propagation-on-item-click
                    @change="(option) => selectWorkspace(option as WorkspaceType)"
                    @escape="onEsc"
                  >
                    <template #listHeader>
                      <div class="text-nc-content-gray-muted text-[13px] px-3 pt-2.5 pb-1.5 font-medium leading-5">
                        {{ $t('labels.duplicateTableMessage') }}
                      </div>

                      <NcDivider />
                    </template>

                    <template #listItemExtraLeft="{ option: optionItem }">
                      <GeneralWorkspaceIcon :workspace="optionItem as WorkspaceType" size="small" />
                    </template>
                    <template #listItemExtraRight="{ option: optionItem }">
                      <div v-if="activeWorkspace?.id === optionItem.id" class="text-nc-content-gray-muted leading-4.5 text-xs">
                        {{ $t('labels.currentWorkspace') }}
                      </div>
                    </template>
                  </NcList>
                </template>
              </NcListDropdown>
            </NcTooltip>
            <LazyPaymentUpgradeBadge
              class="mt-2"
              :feature="PlanFeatureTypes.FEATURE_DUPLICATE_TABLE_TO_OTHER_WS"
              :plan-title="PlanTitles.ENTERPRISE"
              :content="$t('upgrade.upgradeToDuplicateTableToOtherWs')"
              :on-click-callback="
                () => {
                  dialogShow = false
                }
              "
            />
          </div>
        </div>

        <div class="text-nc-content-gray font-medium leading-5">
          {{ $t('objects.project') }}

          <div class="flex items-center content-center gap-2">
            <NcTooltip :disabled="canTargetOtherBase && isTargetOtherBaseSufficientPlan" class="mt-2 flex-1">
              <template v-if="!canTargetOtherBase || !isTargetOtherBaseSufficientPlan" #title>
                <span v-if="!canTargetOtherBase">
                  This table contains linked records that reference data in the current base.
                </span>
                <span v-if="!isTargetOtherBaseSufficientPlan">
                  {{ $t('upgrade.upgradeToDuplicateTableToOtherBase') }}
                </span>
              </template>
              <NcListDropdown
                v-model:is-open="baseDropdownOpen"
                :disabled="!canTargetOtherBase || !isTargetOtherBaseSufficientPlan"
                default-slot-wrapper-class="gap-2"
              >
                <template v-if="!!targetBase">
                  <div class="flex-1 capitalize truncate flex gap-1">
                    <GeneralProjectIcon :color="parseProp(targetBase?.meta ?? {}).iconColor" size="small" />
                    {{ targetBase?.title }}
                  </div>
                </template>
                <template v-else>
                  <div class="flex-1 capitalize truncate flex gap-1"></div>
                </template>
                <div class="flex gap-2 items-center">
                  <div v-if="activeBase?.id === targetBase?.id" class="text-nc-content-gray-muted leading-4.5 text-xs">
                    {{ $t('labels.currentBase') }}
                  </div>
                  <GeneralIcon
                    :class="{
                      'transform rotate-180': baseDropdownOpen,
                    }"
                    class="transition-all w-4 h-4 opacity-80"
                    icon="ncChevronDown"
                  />
                </div>

                <template #overlay="{ onEsc }">
                  <NcList
                    v-model:open="baseDropdownOpen"
                    :value="targetBase?.id ?? ''"
                    :item-height="32"
                    close-on-select
                    class="nc-base-workspace-selection"
                    :min-items-for-search="6"
                    container-class-name="w-full"
                    :list="targetBases"
                    option-label-key="title"
                    option-value-key="id"
                    stop-propagation-on-item-click
                    @change="(option) => selectBase(option as BaseType)"
                    @escape="onEsc"
                  >
                    <template #listHeader>
                      <div class="text-nc-content-gray-muted text-[13px] px-3 pt-2.5 pb-1.5 font-medium leading-5">
                        {{ $t('labels.duplicateTableMessage') }}
                      </div>

                      <NcDivider />
                    </template>

                    <template #listItemExtraLeft="{ option: optionItem }">
                      <GeneralProjectIcon :color="parseProp(optionItem.meta).iconColor" size="small" />
                    </template>
                    <template #listItemExtraRight="{ option: optionItem }">
                      <div v-if="activeBase?.id === optionItem.id" class="text-nc-content-gray-muted leading-4.5 text-xs">
                        {{ $t('labels.currentBase') }}
                      </div>
                    </template>
                  </NcList>
                </template>
              </NcListDropdown>
            </NcTooltip>
            <LazyPaymentUpgradeBadge
              class="mt-2"
              :feature="PlanFeatureTypes.FEATURE_DUPLICATE_TABLE_TO_OTHER_BASE"
              :content="$t('upgrade.upgradeToDuplicateTableToOtherBase')"
              :on-click-callback="
                () => {
                  dialogShow = false
                }
              "
            />
          </div>
        </div>
      </div>
    </div>
    <div class="flex flex-row gap-x-2 mt-5 justify-end">
      <NcButton v-if="!isLoading" key="back" type="secondary" size="small" @click="dialogShow = false">{{
        $t('general.cancel')
      }}</NcButton>
      <NcButton key="submit" v-e="['a:table:duplicate']" type="primary" size="small" :loading="isLoading" @click="_duplicate">
        Duplicate Table
      </NcButton>
    </div>
  </GeneralModal>
</template>

<style scoped lang="scss">
.nc-list-root {
  @apply !w-[432px] !pt-0;
}
</style>

<style lang="scss">
.nc-base-workspace-selection {
  .nc-list {
    @apply !px-1;
    .nc-list-item {
      @apply !py-1;
    }
  }
}
</style>
