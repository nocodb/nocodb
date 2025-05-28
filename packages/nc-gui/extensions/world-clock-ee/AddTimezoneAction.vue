<script setup lang="ts">
import type { NcListItemType } from '../../components/nc/List/index.vue'
import { type AcceptableCity, timezoneData } from './timezone-data'

const props = withDefaults(
  defineProps<{
    disable?: boolean
    disableMessage?: string
    isSidebar?: boolean
    modelValue: string | string[]
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
  defaultValue: props.isSidebar ? [] : '',
})

const options: Ref<NcListItemType[]> = ref(
  timezoneData.map((d) => ({
    value: d.city,
  })),
)

const visible = ref(false)

const onSelect = (option: NcListItemType) => {
  if (props.isSidebar) {
    if (!vModel.value.includes(option.value as AcceptableCity)) {
      emits('citySelected', option.value as AcceptableCity)
    }
  } else {
    emits('citySelected', option.value as AcceptableCity)
    vModel.value = option.value as AcceptableCity
  }
}
</script>

<template>
  <NcDropdown v-model:visible="visible" overlay-class-name="!min-w-auto !w-full !max-w-[277px]" @click.stop>
    <slot>
      <NcTooltip v-if="isSidebar" class="w-full" :title="disableMessage" placement="bottom" :disabled="!disable">
        <NcButton
          type="secondary"
          class="w-full"
          :class="{
            '!text-nc-content-brand': !disable,
          }"
          size="small"
          :disabled="disable"
          inner-class="!gap-1"
        >
          <template #icon>
            <GeneralIcon icon="ncPlus" />
          </template>
          Add City</NcButton
        >
      </NcTooltip>

      <NcButton
        v-else
        type="secondary"
        full-width
        class="nc-country-selector !px-3"
        :class="{
          'nc-active ': visible,
        }"
        size="small"
        :disabled="disable"
      >
        <div class="w-full flex items-center gap-2 text-left">
          <NcTooltip :title="vModel" class="flex-1 max-w-[calc(100%_-_26px)] truncate !leading-5" show-on-truncate-only>
            {{ vModel }}
          </NcTooltip>

          <GeneralIcon icon="arrowDown" class="flex-none" />
        </div>
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
        :is-multi-Select="isSidebar"
        data-testid="nc-column-uitypes-options-list-wrapper"
        @change="onSelect"
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
