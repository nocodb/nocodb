<script lang="ts" setup>
interface Props {
  value: string
}

const props = defineProps<Props>()

const emits = defineEmits<{
  (e: 'update:value', value: string): void
}>()

const vModel = useVModel(props, 'value', emits)

const inputRef = ref()

const onKeydown = (e: KeyboardEvent) => {
  if (e.altKey && e.code === 'KeyB') {
    inputRef.value.input?.blur()
  } else {
    e.stopPropagation()
  }
}
</script>

<template>
  <a-input
    ref="inputRef"
    v-model:value="vModel"
    type="text"
    class="nc-base-search-input nc-input-border-on-value nc-input-shadow !h-8 !px-2.5 !py-1 !rounded-lg"
    :placeholder="`${$t('activity.searchProject').charAt(0).toUpperCase()}${$t('activity.searchProject').slice(1).toLowerCase()}`"
    allow-clear
    @keydown="onKeydown"
  >
    <template #prefix>
      <GeneralIcon icon="search" class="mr-1 h-4 w-4 text-gray-500 group-hover:text-black" />
    </template>
  </a-input>
</template>
