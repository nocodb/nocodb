<script setup lang="ts">
const props = defineProps<{
  modelValue: any[]
}>()

const emits = defineEmits(['update:modelValue'])

interface Option {
  value: string
}

const vModel = useVModel(props, 'modelValue', emits)

const headerList = ref<Option[]>([
  { value: 'A-IM' },
  { value: 'Accept' },
  { value: 'Accept-Charset' },
  { value: 'Accept-Encoding' },
  { value: 'Accept-Language' },
  { value: 'Accept-Datetime' },
  { value: 'Access-Control-Request-Method' },
  { value: 'Access-Control-Request-Headers' },
  { value: 'Authorization' },
  { value: 'Cache-Control' },
  { value: 'Connection' },
  { value: 'Content-Length' },
  { value: 'Content-Type' },
  { value: 'Cookie' },
  { value: 'Date' },
  { value: 'Expect' },
  { value: 'Forwarded' },
  { value: 'From' },
  { value: 'Host' },
  { value: 'If-Match' },
  { value: 'If-Modified-Since' },
  { value: 'If-None-Match' },
  { value: 'If-Range' },
  { value: 'If-Unmodified-Since' },
  { value: 'Max-Forwards' },
  { value: 'Origin' },
  { value: 'Pragma' },
  { value: 'Proxy-Authorization' },
  { value: 'Range' },
  { value: 'Referer' },
  { value: 'TE' },
  { value: 'User-Agent' },
  { value: 'Upgrade' },
  { value: 'Via' },
  { value: 'Warning' },
  { value: 'Non-standard headers' },
  { value: 'Dnt' },
  { value: 'X-Requested-With' },
  { value: 'X-CSRF-Token' },
])

const addHeaderRow = () =>
  vModel.value.push({
    enabled: false,
    name: '',
    value: '',
  })

const deleteHeaderRow = (i: number) => vModel.value.splice(i, 1)

const filterOption = (input: string, option: Option) => option.value.toUpperCase().includes(input.toUpperCase())
</script>

<template>
  <div class="flex flex-col py-3 gap-1.5 w-full">
    <div v-for="(headerRow, idx) in vModel" :key="idx" class="flex relative items-center w-full">
      <a-form-item class="form-item w-8">
        <NcCheckbox v-model:checked="headerRow.enabled" size="large" class="nc-hook-header-checkbox" />
      </a-form-item>
      <a-form-item class="form-item w-3/6">
        <a-auto-complete
          v-model:value="headerRow.name"
          class="!rounded-l-lg !rounded-r-0 nc-input-hook-header-key hover:!border-x-0 !border-gray-200"
          :options="headerList"
          :placeholder="$t('placeholder.key')"
          :filter-option="filterOption"
          dropdown-class-name="border-1 border-gray-200"
        />
      </a-form-item>
      <a-form-item class="form-item w-3/6">
        <a-input
          v-model:value="headerRow.value"
          :placeholder="$t('placeholder.value')"
          class="nc-webhook-header-value-input !border-x-0 hover:!border-x-0 !border-gray-200 !rounded-none"
        />
      </a-form-item>

      <NcButton
        class="!rounded-l-none delete-btn !border-gray-200 !shadow-none"
        type="secondary"
        size="small"
        :disabled="vModel.length === 1"
        @click="deleteHeaderRow(idx)"
      >
        <component :is="iconMap.deleteListItem" />
      </NcButton>
    </div>

    <div class="mt-1.5">
      <NcButton size="small" type="secondary" class="nc-btn-focus" @click="addHeaderRow">
        <div class="flex flex-row items-center gap-x-2">
          <component :is="iconMap.plus" class="flex-none" />
          <div data-rec="true">{{ $t('general.add') }}</div>
        </div>
      </NcButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ant-input {
  box-shadow: none !important;

  &:hover {
    @apply !hover:bg-gray-50;
  }
}

.delete-btn:not([disabled]) {
  @apply !text-gray-500;
}

:deep(.ant-input) {
  @apply !placeholder-gray-500;
}

:deep(.ant-input.nc-webhook-header-value-input) {
  @apply !border-x-0;
}

.ant-input-affix-wrapper {
  @apply px-4 rounded-lg py-2 w-84 border-1 focus:border-brand-500 border-gray-200 !ring-0;
}

.nc-btn-focus:focus {
  @apply !text-brand-500 !shadow-none;
}

:deep(.nc-input-hook-header-key.ant-select.ant-select-auto-complete) {
  @apply !text-sm;

  &.ant-select-focused {
    .ant-select-selector {
      @apply !shadow-none !border-gray-200;
    }
  }
  :deep(.ant-select-selector) {
    @apply !rounded-l-lg !rounded-r-none !border-gray-200;
    .ant-select-selection-search .ant-select-selection-search-input::placeholder {
      @apply !text-gray-500 !text-sm;
    }
  }
  .ant-select-selector {
    @apply !rounded-l-lg !rounded-r-none !border-gray-200;
    .ant-select-selection-search-input {
      @apply !text-sm;
    }
    .ant-select-selection-placeholder {
      @apply !text-gray-500;
    }
  }
}
</style>
