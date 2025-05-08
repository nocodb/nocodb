<script setup lang="ts">
import type { RawValueType } from '../../components/nc/List/index.vue'
import { type AcceptableCity, timezoneData } from './timezone-data'
import type { SelectOption } from './types'

const props = withDefaults(
  defineProps<{
    disable?: boolean
    disableMessage?: string
    isSidebar?: boolean
    modelValue: string
  }>(),
  {
    disable: false,
  },
)

const emits = defineEmits<{
  (e: 'update:value', value: AcceptableCity): void
  (e: 'citySelected', value: AcceptableCity): void
}>()

const vModel = useVModel(props, 'modelValue', emits, {
  defaultValue: '',
})

const options: Ref<SelectOption[]> = ref(
  timezoneData.map((d) => ({
    value: d.city,
  })),
)

const visible = ref(false)

const onSelect = (optionValue: RawValueType) => {
  emits('citySelected', optionValue as AcceptableCity)

  if (props.isSidebar) {
    vModel.value = ''
  } else {
    vModel.value = optionValue as AcceptableCity
  }
}
</script>

<template>
  <NcDropdown v-model:visible="visible" overlay-class-name="!min-w-auto !w-full !max-w-[277px]" @click.stop>
    <slot>
      <NcTooltip v-if="isSidebar" class="w-full" :title="disableMessage" placement="bottom" :disabled="!disable">
        <NcButton type="secondary" class="w-full" size="small" :disabled="disable">+ Add City</NcButton>
      </NcTooltip>

      <NcButton
        v-else
        type="secondary"
        full-width
        class="nc-country-selector w-full !px-3"
        :class="{
          'nc-active ': visible,
        }"
        size="small"
        icon-position="right"
        :disabled="disable"
      >
        <template #icon>
          <GeneralIcon icon="arrowDown" />
        </template>

        {{ vModel }}
      </NcButton>
    </slot>
    <template #overlay>
      <NcList
        v-model:open="visible"
        :value="vModel"
        :list="options"
        option-label-key="value"
        option-value-key="value"
        variant="small"
        class="!w-full"
        data-testid="nc-column-uitypes-options-list-wrapper"
        @update:value="onSelect"
      />
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped>
.nc-country-selector {
  @apply shadow-default font-normal text-nc-content-gray;

  &.nc-active {
    @apply !shadow-selected !border-nc-border-brand;
  }
}
</style>
