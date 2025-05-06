<script setup lang="ts">
import type { NcListProps, RawValueType } from '../../components/nc/List/index.vue'
import { type AcceptableCity, timezoneData } from './timezone-data'
import type { SelectOption } from './types'

defineProps<{
  disable: boolean
  disableMessage: string
}>()

const emits = defineEmits<{
  citySelected: [AcceptableCity]
}>()

const options: Ref<SelectOption[]> = ref(
  timezoneData.map((d) => ({
    value: d.city,
  })),
)

const selectedCity = ref<string>('')

const visible = ref(false)

const onSelect = (optionValue: RawValueType) => {
  emits('citySelected', optionValue as AcceptableCity)
  selectedCity.value = ''
}

const filterOption: NcListProps['filterOption'] = (input, option) => {
  return searchCompare(option?.title ?? option?.value, input)
}
</script>

<template>
  <NcDropdown v-model:visible="visible" @click.stop overlay-class-name="!min-w-auto !w-full !max-w-[277px]">
    <NcTooltip class="w-full" :title="disableMessage" placement="bottom" :disabled="!disable">
      <NcButton type="secondary" class="w-full" size="small" :disabled="disable">+ Add City</NcButton>
    </NcTooltip>
    <template #overlay>
      <NcList
        :value="selectedCity"
        @update:value="onSelect"
        v-model:open="visible"
        :list="options"
        option-label-key="value"
        option-value-key="value"
        variant="small"
        class="!w-full"
        :filter-option="filterOption"
        data-testid="nc-column-uitypes-options-list-wrapper"
      />
    </template>
  </NcDropdown>
</template>
