<script setup lang="ts">
import dayjs from 'dayjs'
import { ColumnHelper, UITypes, dateFormats, dateMonthFormats, jalaliDateFormats, jalaliDateMonthFormats } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

// set default value
vModel.value.meta = {
  ...ColumnHelper.getColumnDefaultMeta(UITypes.Date),
  ...(vModel.value.meta || {}),
}

const { isSystem } = useColumnCreateStoreOrThrow()

const allDateFormats = [...dateFormats, ...dateMonthFormats, ...jalaliDateFormats, ...jalaliDateMonthFormats]

// Examples are rendered against today's date so users see what each format produces
const today = dayjs()

function formatExample(format: string) {
  return today.format(format)
}

const selectedExample = computed(() => formatExample(vModel.value.meta.date_format))
</script>

<template>
  <a-form-item>
    <template #label>
      <div class="flex items-center justify-between w-full gap-2">
        <span class="flex-none">{{ $t('labels.dateFormat') }}</span>
        <span class="flex items-center gap-1.5 min-w-0">
          <span class="flex-none text-nc-content-gray-muted">{{ $t('labels.preview') }}</span>
          <span class="truncate text-nc-content-gray font-weight-500">{{ selectedExample }}</span>
        </span>
      </div>
    </template>
    <a-select
      v-model:value="vModel.meta.date_format"
      :disabled="isSystem"
      show-search
      class="nc-date-select"
      dropdown-class-name="nc-dropdown-date-format"
    >
      <template #suffixIcon>
        <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
      </template>
      <a-select-option v-for="(format, i) of allDateFormats" :key="i" :value="format">
        <div class="w-full flex items-center gap-2">
          <span class="nc-check-gutter flex-none w-4 h-4 flex items-center justify-center">
            <component
              :is="iconMap.check"
              v-if="vModel.meta.date_format === format"
              id="nc-selected-item-icon"
              class="text-nc-content-brand w-4 h-4"
            />
          </span>
          <span class="nc-date-example flex-1 min-w-0 truncate text-nc-content-gray">{{ formatExample(format) }}</span>
          <span class="nc-format-token flex-none">{{ format }}</span>
        </div>
      </a-select-option>
      <template #dropdownRender="{ menuNode: menu }">
        <div class="px-3 pt-2 pb-1 text-nc-content-gray-muted text-captionSm uppercase">
          {{ $t('labels.pickDateFormat') }}
        </div>
        <component :is="menu" />
      </template>
    </a-select>
  </a-form-item>
</template>

<style lang="scss" scoped>
// In the dropdown list the format token is plain muted text alongside the example
.nc-format-token {
  @apply text-nc-content-gray-muted text-captionSm font-mono;
}

// The closed selector reuses the selected option's markup — render it as a clean
// "example + format badge": drop the leading checkmark gutter and pill the token
:deep(.ant-select-selection-item) {
  .nc-check-gutter {
    display: none;
  }

  // keep the example from stretching so the badge sits right next to it (not pushed to the far end)
  .nc-date-example {
    flex: 0 1 auto;
  }

  .nc-format-token {
    @apply bg-nc-bg-gray-light rounded px-1.5 py-0.5 leading-tight;
  }
}
</style>
