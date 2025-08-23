<script setup lang="ts">
import {
  type BaseType,
  type LinkToAnotherRecordType,
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

// #region target base
const wsDropdownOpen = ref(false)
const baseDropdownOpen = ref(false)
const targetWorkspace = ref(activeWorkspace)
const targetBase = ref(activeBase.value)

const targetTableMeta = computedAsync(async () => {
  return getMeta(props.table.id)
})

const canTargetOtherBase = computedAsync(async () => {
  if (!targetTableMeta.value || (targetTableMeta.value.columns?.length ?? 0) === 0) return false
  return isEeUI && !targetTableMeta.value.columns?.some((col) => [UITypes.Links, UITypes.LinkToAnotherRecord].includes(col.uidt))
})

const workspaceOptions = computed(() => {
  if (!isEeUI) return []
  return workspacesList.filter((ws) =>
    [WorkspaceUserRoles.CREATOR, WorkspaceUserRoles.OWNER].includes(ws.roles as WorkspaceUserRoles),
  )
})

const selectWorkspace = (option: WorkspaceType) => {
  targetWorkspace.value = option
  wsDropdownOpen.value = false
}

const targetBases = computedAsync(async () => {
  if (!isEeUI || !targetWorkspace.value) {
    return []
  }
  return await loadProjects(undefined, targetWorkspace.value.id)
})
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
    const jobData = await api.dbTable.duplicate(props.table.base_id!, props.table.id!, { options: optionsToExclude.value })

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

            await loadTables()
            refreshCommandPalette()
            const newTable = tables.value.find((el) => el.id === data?.data?.result?.id)

            openTable(newTable!)
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

const isEaster = ref(false)
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
        <div
          class="flex gap-3 cursor-pointer leading-5 text-nc-content-gray font-medium items-center"
          @click="options.includeData = !options.includeData"
        >
          <NcSwitch :checked="options.includeData" />
          {{ $t('labels.includeRecords') }}
        </div>
        <div
          class="flex gap-3 cursor-pointer leading-5 text-nc-content-gray font-medium items-center"
          @click="options.includeViews = !options.includeViews"
        >
          <NcSwitch :checked="options.includeViews" />
          {{ $t('labels.includeView') }}
        </div>

        <div
          v-show="isEaster"
          class="flex gap-3 cursor-pointer leading-5 text-nc-content-gray font-medium items-center"
          @click="options.includeHooks = !options.includeHooks"
        >
          <NcSwitch :checked="options.includeHooks" />
          {{ $t('labels.includeWebhook') }}
        </div>
      </div>
      <div
        :class="{
          'mb-5': isEeUI,
        }"
        class="mt-5 text-nc-content-gray-subtle2 font-medium"
      >
        {{ $t('labels.tableDuplicateMessage') }}
      </div>

      <div v-if="canTargetOtherBase" class="mb-5">
        <NcDivider divider-class="!my-5" />

        <div class="text-nc-content-gray font-medium leading-5 mb-2">
          {{ $t('labels.workspace') }}
          <NcDropdown v-model:visible="wsDropdownOpen" class="mt-2">
            <div
              class="rounded-lg border-1 transition-all cursor-pointer flex items-center border-nc-border-gray-medium h-8 py-1 gap-2 px-3"
              style="box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08)"
              :class="{
                '!border-brand-500 !shadow-selected': wsDropdownOpen,
              }"
            >
              <GeneralWorkspaceIcon size="small" :workspace="targetWorkspace" />

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
                  class="text-nc-content-gray transition-all w-4 h-4"
                  icon="ncChevronDown"
                />
              </div>
            </div>

            <template #overlay>
              <NcList
                :value="targetWorkspace"
                :item-height="28"
                close-on-select
                class="nc-base-workspace-selection"
                :min-items-for-search="6"
                container-class-name="w-full"
                :list="workspaceOptions"
                option-label-key="title"
              >
                <template #listHeader>
                  <div class="text-nc-content-gray-muted text-[13px] px-3 pt-2.5 pb-1.5 font-medium leading-5">
                    {{ $t('labels.duplicateBaseMessage') }}
                  </div>

                  <NcDivider />
                </template>

                <template #listItem="{ option }">
                  <div class="flex gap-2 w-full items-center" @click="selectWorkspace(option)">
                    <GeneralWorkspaceIcon :workspace="option" size="small" />

                    <div class="flex-1 text-[13px] truncate font-semibold leading-5 capitalize w-full">
                      {{ option.title }}
                    </div>

                    <div class="flex items-center gap-2">
                      <div v-if="activeWorkspace?.id === option.id" class="text-nc-content-gray-muted leading-4.5 text-xs">
                        {{ $t('labels.currentWorkspace') }}
                      </div>
                      <GeneralIcon v-if="option.id === targetWorkspace?.id" class="text-brand-500 w-4 h-4" icon="ncCheck" />
                    </div>
                  </div>
                </template>
              </NcList>
            </template>
          </NcDropdown>
        </div>

        <div class="text-nc-content-gray font-medium leading-5">
          {{ $t('objects.project') }}
          <NcDropdown v-model:visible="baseDropdownOpen" class="mt-2">
            <div
              class="rounded-lg border-1 transition-all cursor-pointer flex items-center border-nc-border-gray-medium h-8 py-1 gap-2 px-3"
              style="box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08)"
              :class="{
                '!border-brand-500 !shadow-selected': baseDropdownOpen,
              }"
            >
              <!-- TODO: base icon
            <GeneralWorkspaceIcon size="small" :workspace="targetWorkspace" />
            -->

              <div class="flex-1 capitalize truncate">
                {{ targetBase?.title }}
              </div>

              <div class="flex gap-2 items-center">
                <div v-if="activeBase?.id === targetBase?.id" class="text-nc-content-gray-muted leading-4.5 text-xs">
                  {{ $t('labels.currentBase') }}
                </div>
                <GeneralIcon
                  :class="{
                    'transform rotate-180': baseDropdownOpen,
                  }"
                  class="text-nc-content-gray transition-all w-4 h-4"
                  icon="ncChevronDown"
                />
              </div>
            </div>

            <template #overlay>
              <NcList
                :value="targetBase"
                :item-height="28"
                close-on-select
                class="nc-base-workspace-selection"
                :min-items-for-search="6"
                container-class-name="w-full"
                :list="targetBases"
                option-label-key="title"
              >
                <template #listHeader>
                  <div class="text-nc-content-gray-muted text-[13px] px-3 pt-2.5 pb-1.5 font-medium leading-5">
                    {{ $t('labels.duplicateBaseMessage') }}
                  </div>

                  <NcDivider />
                </template>

                <template #listItem="{ option }">
                  <div class="flex gap-2 w-full items-center" @click="selectBase(option)">
                    <!-- TODO: base icon
                      <GeneralWorkspaceIcon :workspace="option" size="small" />
                    -->

                    <div class="flex-1 text-[13px] truncate font-semibold leading-5 capitalize w-full">
                      {{ option.title }}
                    </div>

                    <div class="flex items-center gap-2">
                      <div v-if="activeBase?.id === option.id" class="text-nc-content-gray-muted leading-4.5 text-xs">
                        {{ $t('labels.currentBase') }}
                      </div>
                      <GeneralIcon v-if="option.id === targetBase?.id" class="text-brand-500 w-4 h-4" icon="ncCheck" />
                    </div>
                  </div>
                </template>
              </NcList>
            </template>
          </NcDropdown>
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
