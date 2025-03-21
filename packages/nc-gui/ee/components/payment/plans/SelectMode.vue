<script lang="ts" setup>
const props = defineProps<{
  value: 'year' | 'month'
  discount?: number
}>()

const emit = defineEmits(['update:value', 'change'])

const vModel = useVModel(props, 'value', (_, val) => {
  emit('update:value', val)
  emit('change', val)
})
</script>

<template>
  <div class="flex flex-row p-1 bg-gray-200 rounded-lg gap-x-0.5 w-[fit-content] text-nc-content-gray-subtle2 font-weight-500">
    <div
      class="tab"
      :class="{
        active: vModel === 'month',
      }"
      @click="vModel = 'month'"
    >
      <div class="tab-title nc-tab">{{ $t('general.monthly') }}</div>
    </div>
    <div
      class="tab"
      :class="{
        active: vModel === 'year',
      }"
      @click="vModel = 'year'"
    >
      <div class="tab-title nc-tab">{{ $t('general.annually') }}</div>
      <span
        v-if="props.discount"
        class="flex items-center gap-1 px-1 py-[3px] bg-nc-bg-green-light rounded-[6px] text-xs text-nc-content-green-dark"
      >
        -{{ props.discount }}%
      </span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.tab {
  @apply flex flex-row items-center h-8 justify-center px-2 py-1 rounded-[6px] gap-x-2 text-gray-600 hover:text-black cursor-pointer transition-all duration-300 select-none hover:text-brand-600;
}

.tab-icon {
  font-size: 1rem !important;
  @apply w-4;
}
.tab .tab-title {
  @apply min-w-0;
  word-break: keep-all;
  white-space: nowrap;
  display: inline;
  line-height: 0.95;
}

.active {
  @apply bg-white text-nc-content-gray-emphasis font-semibold;

  box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);
}
</style>
