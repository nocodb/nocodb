<script lang="ts" setup>
interface Props {
  value: string
  isLoading?: boolean
}

const props = defineProps<Props>()

const emits = defineEmits<{
  (e: 'update:value', value: string): void
}>()

const vModel = useVModel(props, 'value', emits)

const { isLoading } = toRefs(props)

const { t } = useI18n()

const inputRef = ref()

const placeholder = computed(() => {
  return isLoading.value
    ? `${t('general.search')}...`
    : `${t('activity.searchProject').charAt(0).toUpperCase()}${t('activity.searchProject').slice(1).toLowerCase()}`
})

const onKeydown = (e: KeyboardEvent) => {
  if (e.altKey && (e.code === 'KeyB' || e.code === 'KeyD')) {
    e.preventDefault()
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
    :placeholder="placeholder"
    allow-clear
    :readonly="isLoading"
    @keydown="onKeydown"
  >
    <template #prefix>
      <GeneralIcon icon="search" class="mr-1 h-4 w-4 text-gray-500 group-hover:text-black" />
    </template>
  </a-input>
</template>
