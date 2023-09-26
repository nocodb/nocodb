<script setup lang="ts">
const props = defineProps<{
  current: number
  total: number
  pageSize: number
}>()

const emits = defineEmits(['update:current', 'update:pageSize'])

const { total } = toRefs(props)

const current = useVModel(props, 'current', emits)

const pageSize = useVModel(props, 'pageSize', emits)

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

const { isMobileMode } = useGlobal()

const changePage = ({ increase }: { increase: boolean }) => {
  if (increase && current.value < totalPages.value) {
    current.value = current.value + 1
  } else if (current.value > 0) {
    current.value = current.value - 1
  }
}
</script>

<template>
  <div class="nc-pagination flex flex-row items-center gap-x-2">
    <NcButton type="secondary" size="small" :disabled="current === 1" @click="changePage({ increase: false })">
      <GeneralIcon icon="arrowLeft" />
    </NcButton>
    <div class="text-gray-600">{{ current }} {{ isMobileMode ? '/' : 'of' }} {{ totalPages }}</div>

    <NcButton type="secondary" size="small" :disabled="current === totalPages" @click="changePage({ increase: true })">
      <GeneralIcon icon="arrowRight" />
    </NcButton>
  </div>
</template>
