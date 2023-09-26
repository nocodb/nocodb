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

const goToLastPage = () => {
  current.value = totalPages.value
}

const goToFirstPage = () => {
  current.value = 1
}
</script>

<template>
  <div class="nc-pagination flex flex-row items-center gap-x-2">
    <NcButton
      v-if="!isMobileMode"
      class="first-page"
      type="secondary"
      size="small"
      :disabled="current === 1"
      @click="goToFirstPage"
    >
      <GeneralIcon icon="doubleLeftArrow" />
    </NcButton>

    <NcButton class="prev-page" type="secondary" size="small" :disabled="current === 1" @click="changePage({ increase: false })">
      <GeneralIcon icon="arrowLeft" />
    </NcButton>
    <div class="text-gray-600">
      <span class="active"> {{ current }} </span>
      <span class="mx-1"> {{ isMobileMode ? '/' : 'of' }} </span>
      <span class="total">
        {{ totalPages }}
      </span>
    </div>

    <NcButton
      class="next-page"
      type="secondary"
      size="small"
      :disabled="current === totalPages"
      @click="changePage({ increase: true })"
    >
      <GeneralIcon icon="arrowRight" />
    </NcButton>

    <NcButton
      v-if="!isMobileMode"
      class="last-page"
      type="secondary"
      size="small"
      :disabled="current === totalPages"
      @click="goToLastPage"
    >
      <GeneralIcon icon="doubleRightArrow" />
    </NcButton>
  </div>
</template>
