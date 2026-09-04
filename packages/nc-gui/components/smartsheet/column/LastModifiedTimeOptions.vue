<script setup lang="ts">
import { type ColumnType, UITypes, isAllowedLmtTrackedField } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const { setAdditionalValidations } = useColumnCreateStoreOrThrow()

const { t } = useI18n()

const meta = inject(MetaInj, ref())

const isDropdownOpen = ref(false)

// tracking specific fields relies on the row-meta column, which only
// EE + PG internal tables have — hide the whole section elsewhere
const supportsFieldTracking = computed(() => (meta.value?.columns || []).some((c) => c.uidt === UITypes.Meta))

const trackableFields = computed<ColumnType[]>(() =>
  (meta.value?.columns || []).filter((c) => c.id && c.id !== vModel.value.id && isAllowedLmtTrackedField(c)),
)

const fieldsMode = computed<'all' | 'specific'>({
  get: () => (vModel.value.meta?.fields_mode === 'specific' ? 'specific' : 'all'),
  set: (mode) => {
    if (!vModel.value.meta) vModel.value.meta = {}
    vModel.value.meta.fields_mode = mode
    if (mode === 'specific' && !Array.isArray(vModel.value.meta.tracked_field_ids)) {
      vModel.value.meta.tracked_field_ids = []
    }
  },
})

const trackedFieldIds = computed<string[]>({
  get: () => vModel.value.meta?.tracked_field_ids || [],
  set: (ids) => {
    if (!vModel.value.meta) vModel.value.meta = {}
    vModel.value.meta.tracked_field_ids = ids
  },
})

const selectedFields = computed(
  () => trackedFieldIds.value.map((id) => trackableFields.value.find((c) => c.id === id)).filter(Boolean) as ColumnType[],
)

function removeFieldId(colId: string) {
  trackedFieldIds.value = trackedFieldIds.value.filter((id) => id !== colId)
}

setAdditionalValidations({
  meta: [
    {
      validator: () => {
        if (supportsFieldTracking.value && fieldsMode.value === 'specific' && !trackedFieldIds.value.length) {
          return Promise.reject(new Error(t('msg.error.selectAtLeastOneFieldToTrack')))
        }
        return Promise.resolve()
      },
    },
  ],
})
</script>

<template>
  <div v-if="supportsFieldTracking" class="nc-lmt-fields-options flex flex-col gap-2">
    <a-form-item>
      <a-radio-group v-model:value="fieldsMode" class="nc-lmt-fields-mode !flex !flex-col gap-1">
        <a-radio value="all" data-testid="nc-lmt-fields-mode-all">
          <span class="text-nc-content-gray-subtle text-small">{{ $t('labels.allEditableFields') }}</span>
        </a-radio>
        <a-radio value="specific" data-testid="nc-lmt-fields-mode-specific">
          <span class="text-nc-content-gray-subtle text-small">{{ $t('labels.specificFields') }}</span>
        </a-radio>
      </a-radio-group>
    </a-form-item>

    <template v-if="fieldsMode === 'specific'">
      <div class="text-nc-content-gray-muted text-small leading-4.5">
        {{ $t('labels.specificFieldsHelpText') }}
      </div>

      <NcDropdown v-model:visible="isDropdownOpen" overlay-class-name="!pt-0">
        <NcButton
          size="xs"
          type="secondary"
          data-testid="nc-lmt-select-tracked-fields"
          :class="{
            '!shadow-selected !border-nc-border-brand': isDropdownOpen,
          }"
        >
          <div class="flex items-center justify-center gap-2">
            <GeneralIcon icon="plus" />
            {{ $t('labels.selectFields') }}
          </div>
        </NcButton>
        <template #overlay>
          <NcList
            v-model:value="trackedFieldIds"
            v-model:open="isDropdownOpen"
            class="nc-lmt-tracked-fields-list"
            is-multi-select
            :close-on-select="false"
            :list="trackableFields"
            variant="small"
            option-value-key="id"
            option-label-key="title"
          >
            <template #headerExtraRight>
              <NcBadge :border="false" color="brand" class="mr-2">
                {{ trackedFieldIds.length }} {{ $t('objects.fields').toLowerCase() }}
              </NcBadge>
            </template>

            <template #listItem="{ option }">
              <div
                class="flex items-center w-full truncate gap-3 text-nc-content-gray-subtle hover:text-nc-content-gray-extreme transition-colors"
              >
                <SmartsheetHeaderIcon :column="option" />

                <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                  <template #title>
                    {{ option?.title }}
                  </template>
                  <div class="flex-1 font-550 leading-5 text-small">
                    {{ option?.title }}
                  </div>
                </NcTooltip>

                <NcCheckbox :checked="!!trackedFieldIds.includes(option.id)" />
              </div>
            </template>
          </NcList>
        </template>
      </NcDropdown>

      <div v-if="selectedFields.length" class="gap-2 flex flex-wrap min-h-5.5">
        <div
          v-for="col of selectedFields"
          :key="col.id"
          class="bg-nc-bg-gray-medium text-nc-content-gray-subtle2 px-1 py-0.5 rounded-md flex gap-1 items-center"
        >
          <SmartsheetHeaderIcon :column="col" />

          <div class="text-[13px] font-default leading-4.5">
            {{ col.title }}
          </div>

          <div class="w-0.25 h-4 bg-nc-border-gray-dark" />

          <GeneralIcon class="cursor-pointer opacity-70 hover:opacity-100" icon="close" @click="removeFieldId(col.id!)" />
        </div>
      </div>
      <div v-else class="flex flex-row text-nc-content-gray-disabled">
        {{ $t('title.noFieldsSelected') }}
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.nc-lmt-tracked-fields-list {
  // NcList hardcodes w-64 on its root; stretch it to the dropdown overlay,
  // which already matches the trigger button width
  @apply !w-full;

  :deep(.nc-list-item) {
    .ant-checkbox-checked .ant-checkbox-inner {
      background-color: var(--nc-brand-accent) !important;
      border-color: var(--nc-brand-accent) !important;
    }

    .ant-checkbox {
      @apply !mr-0;
    }

    .nc-icon {
      @apply mx-0;
    }
  }

  :deep(.nc-cell-icon),
  :deep(.nc-virtual-cell-icon) {
    @apply w-3.5 h-3.5 mx-0 flex-none;
  }
}

.nc-lmt-fields-options {
  :deep(.nc-cell-icon),
  :deep(.nc-virtual-cell-icon) {
    @apply w-3.5 h-3.5 mx-0 flex-none;
  }
}
</style>
