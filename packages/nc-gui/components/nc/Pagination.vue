<script setup lang="ts">
const props = defineProps<{
  current: number
  total: number
  pageSize: number
  entityName?: string
  mode?: 'simple' | 'full'
}>()

const emits = defineEmits(['update:current', 'update:pageSize'])

const { total } = toRefs(props)

const current = useVModel(props, 'current', emits)

const pageSize = useVModel(props, 'pageSize', emits)

const entityName = computed(() => props.entityName || 'item')

const totalPages = computed(() => Math.max(Math.ceil(total.value / pageSize.value), 1))

const { isMobileMode } = useGlobal()

const mode = computed(() => props.mode || (isMobileMode.value ? 'simple' : 'full'))

const changePage = ({ increase, set }: { increase?: boolean; set?: number }) => {
  if (set) {
    current.value = set
  } else if (increase && current.value < totalPages.value) {
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

const pagesList = computed(() => {
  return Array.from({ length: totalPages.value }, (_, i) => ({
    value: i + 1,
    label: i + 1,
  }))
})
</script>

<template>
  <div class="nc-pagination flex flex-row items-center gap-x-2">
    <NcButton
      v-if="mode === 'full'"
      v-e="[`a:pagination:${entityName}:first-page`]"
      class="first-page"
      type="secondary"
      size="small"
      :disabled="current === 1"
      @click="goToFirstPage"
    >
      <GeneralIcon icon="doubleLeftArrow" />
    </NcButton>

    <NcButton
      v-e="[`a:pagination:${entityName}:prev-page`]"
      class="prev-page"
      type="secondary"
      size="small"
      :disabled="current === 1"
      @click="changePage({ increase: false })"
    >
      <GeneralIcon icon="arrowLeft" />
    </NcButton>
    <div v-if="!isMobileMode" class="text-gray-600">
      <a-select v-model:value="current" class="!mr-[2px]" :options="pagesList">
        <template #suffixIcon>
          <GeneralIcon icon="arrowDown" class="text-gray-500 nc-select-expand-btn" />
        </template>
      </a-select>
      <span class="mx-1"> {{ mode !== 'full' ? '/' : 'of' }} </span>
      <span class="total">
        {{ totalPages }}
      </span>
    </div>

    <NcButton
      v-e="[`a:pagination:${entityName}:next-page`]"
      class="next-page"
      type="secondary"
      size="small"
      :disabled="current === totalPages"
      @click="changePage({ increase: true })"
    >
      <GeneralIcon icon="arrowRight" />
    </NcButton>

    <NcButton
      v-if="mode === 'full'"
      v-e="[`a:pagination:${entityName}:last-page`]"
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

<style lang="scss" scoped>
:deep(.ant-select-selector) {
  @apply !border-gray-200 !rounded-lg;
}

:deep(.ant-select-dropdown) {
  @apply !rounded-lg !overflow-hidden;
}
</style>
