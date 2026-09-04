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
// EE + PG internal tables have — render nothing elsewhere
const supportsFieldTracking = computed(() => (meta.value?.columns || []).some((c) => c.uidt === UITypes.Meta))

const trackableFields = computed<ColumnType[]>(() =>
  (meta.value?.columns || []).filter((c) => c.id && c.id !== vModel.value.id && isAllowedLmtTrackedField(c)),
)

const fieldsMode = computed<'all' | 'specific'>({
  get: () => (vModel.value.meta?.fields_mode === 'specific' ? 'specific' : 'all'),
  set: (mode) => {
    if (!vModel.value.meta) vModel.value.meta = {}
    vModel.value.meta.fields_mode = mode
    if (mode === 'specific') {
      if (!Array.isArray(vModel.value.tracked_field_ids)) {
        vModel.value.tracked_field_ids = []
      }
      // picking fields is the obvious next step — open the picker right away
      // (next tick: the dropdown trigger mounts with this same state change)
      nextTick(() => {
        isDropdownOpen.value = true
      })
    }
  },
})

const isSpecificFields = computed(() => fieldsMode.value === 'specific')

// persisted as junction rows on the backend and hydrated onto the column
// as a top-level property (like webhook trigger_fields) — not in meta
const trackedFieldIds = computed<string[]>({
  get: () => vModel.value.tracked_field_ids || [],
  set: (ids) => {
    vModel.value.tracked_field_ids = ids
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
        if (supportsFieldTracking.value && isSpecificFields.value && !trackedFieldIds.value.length) {
          return Promise.reject(new Error(t('msg.error.selectAtLeastOneFieldToTrack')))
        }
        return Promise.resolve()
      },
    },
  ],
})
</script>

<template>
  <div v-if="supportsFieldTracking" class="nc-lmt-fields-options w-full flex flex-col gap-3">
    <a-radio-group v-model:value="fieldsMode" class="nc-lmt-fields-mode !flex !flex-col gap-3">
      <a-radio v-e="['c:field:lmt:fields-mode', { mode: 'all' }]" value="all" data-testid="nc-lmt-fields-mode-all">
        <span class="text-sm text-nc-content-gray select-none">{{ $t('labels.allEditableFields') }}</span>
      </a-radio>
      <a-radio v-e="['c:field:lmt:fields-mode', { mode: 'specific' }]" value="specific" data-testid="nc-lmt-fields-mode-specific">
        <span class="text-sm text-nc-content-gray select-none">{{ $t('labels.specificFields') }}</span>
      </a-radio>
    </a-radio-group>

    <template v-if="isSpecificFields || selectedFields.length">
      <div class="pl-6 w-full flex flex-col gap-3">
        <div v-if="selectedFields.length" class="gap-2 flex flex-wrap min-h-5.5">
          <div
            v-for="col of selectedFields"
            :key="col.id"
            class="bg-nc-bg-gray-light px-1 py-0.5 rounded-md flex gap-1 items-center"
            :class="isSpecificFields ? 'text-nc-content-gray-subtle2' : 'text-nc-content-gray-muted'"
          >
            <SmartsheetHeaderIcon :column="col" color="text-nc-content-gray-muted" />

            <div class="text-[13px] font-default leading-4.5">
              {{ col.title }}
            </div>

            <template v-if="isSpecificFields">
              <div class="w-0.25 h-4 bg-nc-border-gray-dark" />

              <GeneralIcon
                v-e="['c:field:lmt:remove-tracked-field']"
                class="cursor-pointer opacity-70 hover:opacity-100"
                icon="close"
                @click="removeFieldId(col.id!)"
              />
            </template>
          </div>
        </div>

        <NcDropdown v-model:visible="isDropdownOpen" :disabled="!isSpecificFields" overlay-class-name="!pt-0">
          <NcButton
            v-e="['c:field:lmt:select-tracked-fields']"
            size="small"
            type="text"
            class="self-start"
            :disabled="!isSpecificFields"
            data-testid="nc-lmt-select-tracked-fields"
          >
            <div
              class="flex items-center gap-2 text-sm font-normal"
              :class="isSpecificFields ? '!text-nc-content-gray-subtle' : ''"
            >
              <GeneralIcon icon="ncEdit" class="nc-lmt-edit-icon h-4 w-4" />

              <span>
                {{ selectedFields.length ? $t('labels.changeSelectedFields') : $t('labels.selectFields') }}
              </span>
            </div>
          </NcButton>
          <template #overlay>
            <!-- escape must only close this dropdown — stop it from
                 bubbling to the field modal's own escape handling -->
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
              @keydown.esc.stop.prevent="isDropdownOpen = false"
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
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
// lighten the edit icon stroke to match the font-normal button label
:deep(.nc-lmt-edit-icon path) {
  stroke-width: 1;
}

.nc-lmt-fields-mode {
  // plain radios — neutralize the bordered/box-shadow radio style the field
  // modal applies to ant-radio-wrapper globally
  :deep(.ant-radio-wrapper) {
    @apply !m-0 !p-0 flex items-center;
    box-shadow: none !important;

    &:hover,
    &:focus-within {
      box-shadow: none !important;
    }

    .ant-radio {
      @apply top-0;
    }

    .ant-radio + span {
      @apply pl-2 pr-0;
    }
  }
}

.nc-lmt-tracked-fields-list {
  // NcList hardcodes w-64 on its root; widen it — the trigger is a compact
  // text button, so the overlay sizes to the list rather than the trigger
  @apply !w-80;

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
