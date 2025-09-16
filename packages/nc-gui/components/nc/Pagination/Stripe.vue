<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    current: number
    pageSize: number
    entityName?: string
    showSizeChanger?: boolean
    /**
     * Has more records
     */
    hasMore?: boolean
  }>(),
  {},
)

const emits = defineEmits(['update:current', 'update:pageSize'])

const { showSizeChanger, hasMore } = toRefs(props)

const current = useVModel(props, 'current', emits)

const pageSize = useVModel(props, 'pageSize', emits)

const entityName = computed(() => props.entityName || 'item')

const { isMobileMode } = useGlobal()

const changePage = ({ increase, set }: { increase?: boolean; set?: number }) => {
  if (set) {
    current.value = set
  } else if (increase && hasMore.value) {
    current.value = current.value + 1
  } else if (current.value > 1) {
    current.value = current.value - 1
  }
}

const pageSizeOptions = [
  {
    value: 10,
    label: '10 / page',
  },
  {
    value: 25,
    label: '25 / page',
  },
  {
    value: 50,
    label: '50 / page',
  },
  {
    value: 75,
    label: '75 / page',
  },
  {
    value: 100,
    label: '100 / page',
  },
]

const pageSizeRef = ref()

const pageSizeDropdownVisibleChange = (value: boolean) => {
  if (!value && pageSizeRef.value) {
    pageSizeRef.value?.blur()
  }
}
</script>

<template>
  <div class="nc-pagination-stripe flex flex-row items-center gap-x-2">
    <div>
      <NcButton
        v-e="[`a:pagination:${entityName}:prev-page`]"
        class="prev-page"
        type="secondary"
        size="xsmall"
        :disabled="current === 1"
        @click="changePage({ increase: false })"
      >
        <GeneralIcon icon="arrowLeft" class="nc-pagination-icon" />
      </NcButton>
    </div>

    <div v-if="!isMobileMode" class="text-nc-content-gray-muted">
      {{ current }}
    </div>

    <div>
      <NcButton
        v-e="[`a:pagination:${entityName}:next-page`]"
        class="next-page"
        type="secondary"
        size="xsmall"
        :disabled="!hasMore"
        @click="changePage({ increase: true })"
      >
        <GeneralIcon icon="arrowRight" class="nc-pagination-icon" />
      </NcButton>
    </div>

    <div v-if="showSizeChanger && !isMobileMode" class="text-nc-content-gray-muted">
      <a-select
        ref="pageSizeRef"
        v-model:value="pageSize"
        class="!min-w-[110px]"
        :options="pageSizeOptions"
        size="small"
        dropdown-class-name="nc-pagination-dropdown"
        @dropdown-visible-change="pageSizeDropdownVisibleChange"
      >
        <template #suffixIcon>
          <GeneralIcon icon="arrowDown" class="text-nc-content-gray-muted nc-select-page-size-expand-btn" />
        </template>
      </a-select>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-select-selector) {
  @apply !border-nc-border-gray-medium !rounded-lg !h-[25px];
}

.nc-pagination-icon {
  @apply w-4 h-4;
}

:deep(.nc-button:not(:disabled)) {
  .nc-pagination-icon {
    @apply !text-nc-content-gray-muted;
  }
}
</style>

<style lang="scss">
.nc-pagination-dropdown {
  @apply !rounded-lg;
}
</style>
