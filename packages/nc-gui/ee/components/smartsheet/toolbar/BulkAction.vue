<script setup lang="ts">
import type { ButtonType, ColumnType } from 'nocodb-sdk'
import { ButtonActionsType, UITypes, isActionButtonCol } from 'nocodb-sdk'

const open = ref(false)

const { isMobileMode } = useGlobal()

const { isActionPaneActive } = useSmartsheetStoreOrThrow()

const { $api } = useNuxtApp()

const isLocked = inject(IsLockedInj, ref(false))

const { view, meta, xWhere } = useSmartsheetStoreOrThrow()

const buttonActionColumns = computed(
  () =>
    (meta.value?.columns ?? []).filter((col) => isActionButtonCol(col)) as (ColumnType & {
      colOptions: ButtonType
    })[],
)
useMenuCloseOnEsc(open)

const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)

const { isFeatureEnabled } = useBetaFeatureToggle()

const isAiButtonEnabled = computed(() => {
  return isFeatureEnabled(FEATURE_FLAG.AI_FEATURES)
})

const { t } = useI18n()

const buttonTypes = computed(() => [
  {
    label: t('labels.runWebHook'),
    value: ButtonActionsType.Webhook,
    icon: 'webhook',
  },
  ...(isAiButtonEnabled.value
    ? [
        {
          label: t('labels.generateFieldDataUsingAi'),
          value: ButtonActionsType.Ai,
          icon: 'ncAutoAwesome',
        },
      ]
    : []),
  ...(isEeUI
    ? [
        {
          label: t('labels.runScript'),
          value: ButtonActionsType.Script,
          icon: 'ncScript',
        },
      ]
    : []),
])

const isNewFieldOpen = ref(false)

const isColumnDropdownVisible = reactive({
  update: false,
  create: false,
})

const editOrAddProviderRef = ref()

const onVisibilityChange = (status: 'update' | 'create') => {
  isColumnDropdownVisible[status] = !(editOrAddProviderRef.value && !editOrAddProviderRef.value?.shouldKeepModalOpen())
}

const saveColumnCallback = (column: ColumnType) => {
  if (editOrAddProviderRef.value) {
    editOrAddProviderRef.value?.saveColumn(column)
  }
}

const activeColumn = ref<ColumnType>()

const overlayElement = ref()

const newColumn = (button: { label: string; value: ButtonActionsType }) => {
  activeColumn.value = {
    type: button.value,
    uidt: UITypes.Button,
  }

  if (!isColumnDropdownVisible.create) {
    isColumnDropdownVisible.create = true
  }
}

const editColumn = (
  column: ColumnType & {
    colOptions: ButtonType
  },
) => {
  activeColumn.value = column
  if (!isColumnDropdownVisible.update) {
    isColumnDropdownVisible.update = true
  }
}

const activeActionPane = () => {
  isActionPaneActive.value = true
  open.value = false
}

const { base } = storeToRefs(useBase())

const { loadAutomation } = useAutomationStore()

const executionStatus = ref(
  new Map<
    string,
    {
      status: 'loading' | 'success' | 'error'
    }
  >(),
)

const { runScript } = useScriptExecutor()

const executeScript = async (
  button: ColumnType & {
    colOptions: ButtonType
  },
) => {
  executionStatus.value.set(button.id!, {
    status: 'loading',
  })

  const processedPks = new Set()
  const CHUNK_SIZE = 50
  let offset = 0

  try {
    const automation = await loadAutomation(button.colOptions.fk_script_id!)

    while (true) {
      const data = await $api.dbViewRow.list('noco', base.value.id!, meta.value!.id!, view.value!.id!, {
        where: xWhere.value,
        limit: CHUNK_SIZE,
        offset,
      })

      if (data.list.length === 0) break

      for (const row of data.list) {
        const pk = extractPkFromRow(row, meta.value?.columns ?? [])
        if (!processedPks.has(pk)) {
          runScript(automation, row, {
            pk,
            fieldId: button.id,
          }).then(() => {
            processedPks.add(pk)
          })
        }
      }

      if (data.list.length < CHUNK_SIZE) break
      offset += CHUNK_SIZE
    }

    executionStatus.value.set(button.id, {
      status: 'success',
    })
  } catch (error) {
    console.error('Bulk execution failed:', error)
    executionStatus.value.set(button.id, {
      status: 'error',
    })
  }
}

const executeAction = async (
  button: ColumnType & {
    colOptions: ButtonType
  },
) => {
  if (button.colOptions.type === ButtonActionsType.Script) {
    await executeScript(button)
  }
}
</script>

<template>
  <NcDropdown
    v-model:visible="open"
    :trigger="['click']"
    class="!xs:hidden"
    overlay-class-name="nc-dropdown-action-menu nc-toolbar-dropdown overflow-hidden"
  >
    <NcTooltip :disabled="!isMobileMode && !isToolbarIconMode">
      <template #title>
        {{ $t('activity.sort') }}
      </template>
      <NcButton
        v-e="['c:execute:action']"
        class="nc-action-menu-btn nc-toolbar-btn !h-7 !border-0"
        size="small"
        type="secondary"
        :show-as-disabled="isLocked"
      >
        <div class="flex items-center gap-1 min-h-5">
          <div class="flex items-center gap-2">
            <component :is="iconMap.ncPlay" class="h-4 w-4 text-inherit" />

            <!-- Sort -->
            <span v-if="!isMobileMode && !isToolbarIconMode" class="text-capitalize !text-[13px] font-medium">{{
              $t('activity.runActions')
            }}</span>
          </div>
        </div>
      </NcButton>
    </NcTooltip>

    <template #overlay>
      <div
        :class="{
          'nc-locked-view': isLocked,
        }"
      >
        <div class="pt-2 pb-2 nc-action-list max-h-[max(80vh,30rem)] min-w-102" data-testid="nc-actions-menu">
          <div v-for="button in buttonActionColumns" :key="button.id" class="px-3 flex pb-2">
            <NcButton
              :disabled="executionStatus.get(button.id)?.status === 'loading'"
              class="w-full !rounded-r-none"
              type="secondary"
              full-width
              size="small"
              :loading="executionStatus.get(button.id)?.status === 'loading'"
              @click="executeAction(button)"
            >
              <div class="flex gap-2 w-full items-center">
                <GeneralIcon v-if="button.colOptions.icon" :icon="button.colOptions.icon" class="!w-4 min-w-4 min-h-4 !h-4" />
                {{ button.colOptions.label }}
              </div>

              <div class="flex-1" />
            </NcButton>

            <NcButton size="small" class="!rounded-l-none !border-l-0" type="secondary" @click="editColumn(button)">
              <GeneralIcon icon="ncEdit" />
            </NcButton>
          </div>

          <a-dropdown
            v-model:visible="isColumnDropdownVisible.update"
            :disabled="isLocked"
            :trigger="[]"
            placement="right"
            overlay-class-name="nc-dropdown-edit-column"
            @visible-change="onVisibilityChange('update')"
          >
            <template #overlay>
              <div ref="overlayElement" class="nc-edit-or-add-provider-wrapper">
                <LazySmartsheetColumnEditOrAddProvider
                  v-if="isColumnDropdownVisible.update"
                  ref="editOrAddProviderRef"
                  :column="activeColumn"
                  @submit="saveColumnCallback"
                  @cancel="isColumnDropdownVisible.update = false"
                  @click.stop
                  @keydown.stop
                />
              </div>
            </template>
          </a-dropdown>

          <NcDivider />

          <div class="px-2">
            <NcButton full-width class="w-full new-btn-action" type="text" size="small" @click="isNewFieldOpen = !isNewFieldOpen">
              <div class="flex items-center !w-full justify-between gap-3">
                <div class="flex text-nc-content-brand gap-2 items-center">
                  <GeneralIcon icon="ncPlus" />
                  {{ $t('labels.newAction') }}
                </div>
                <div class="flex-1" />
                <GeneralIcon icon="arrowDown" />
              </div>
            </NcButton>

            <a-dropdown
              v-model:visible="isColumnDropdownVisible.create"
              :disabled="isLocked"
              :trigger="[]"
              placement="right"
              overlay-class-name="nc-dropdown-add-column"
              @visible-change="onVisibilityChange('create')"
            >
              <template #overlay>
                <div ref="overlayElement" class="nc-edit-or-add-provider-wrapper">
                  <LazySmartsheetColumnEditOrAddProvider
                    v-if="isColumnDropdownVisible.create"
                    ref="editOrAddProviderRef"
                    :preload="activeColumn"
                    @submit="saveColumnCallback"
                    @cancel="isColumnDropdownVisible.create = false"
                    @click.stop
                    @keydown.stop
                  />
                </div>
              </template>
            </a-dropdown>
            <div
              :class="{
                '!h-0': !isNewFieldOpen,
                'h-28.5': isNewFieldOpen,
              }"
              class="pl-3.5 overflow-hidden transition-all"
            >
              <div
                v-for="button in buttonTypes"
                :key="button.label"
                class="flex px-4 cursor-pointer hover:bg-nc-bg-gray-light items-center rounded-md gap-2 py-2"
                @click="() => newColumn(button)"
              >
                <GeneralIcon class="w-4 h-4 text-nc-content-gray-subtle" :icon="button.icon" />
                <div class="flex-1 text-nc-content-gray">{{ button.label }}</div>
              </div>
            </div>
          </div>
          <NcDivider />
          <div class="px-2">
            <NcButton full-width class="w-full" type="text" size="small" @click="activeActionPane">
              <div class="flex items-center !w-full gap-2">
                <GeneralIcon icon="ncList" />
                {{ $t('labels.actionLogs') }}
              </div>
            </NcButton>
          </div>
        </div>

        <GeneralLockedViewFooter v-if="isLocked" class="-mt-2" @on-open="open = false" />
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss">
.new-btn-action {
  .nc-btn-inner {
    @apply justify-start !w-full;
  }
}
</style>
