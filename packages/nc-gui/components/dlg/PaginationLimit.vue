<script setup lang="ts">
import {
  Form,
  TabType,
  computed,
  nextTick,
  onMounted,
  ref,
  useBase,
  useTableNew,
  useTablesStore,
  useTabs,
  useVModel,
  validateTableName,
} from '#imports'

import NcTooltip from '~/components/nc/Tooltip.vue'
import { useGlobal } from '#imports'

const props = defineProps<{
  modelValue: boolean
  sourceId: string
  baseId: string
  current: number
  total: number
  pageSize: number
  mode?: 'simple' | 'full'
  prevPageTooltip?: string
  nextPageTooltip?: string
  firstPageTooltip?: string
  lastPageTooltip?: string
  showSizeChanger?: boolean
}>()

// const emit = defineEmits(['update:modelValue', 'create'])
const emits = defineEmits(['update:current', 'update:pageSize'])

const dialogShow = useVModel(props, 'modelValue', emits)

const { total, showSizeChanger } = toRefs(props)

const current = useVModel(props, 'current', emits)

const pageSize = useVModel(props, 'pageSize', emits)

const { gridViewPageSize, setGridViewPageSize } = useGlobal()



const localPageSize = computed({
  get: () => {
    return gridViewPageSize.value
  },
  set: (val) => {
    // reset to default value if user input is empty
    if (!val) {
      val = 25
    }
    setGridViewPageSize(val)
    pageSize.value = val
  },
})

const pageSizeOptions = [
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

const pageSizeDefaults = pageSizeOptions.map((item) => item.value)


const customPageValue = computed({
  get: () => {
    return ""
  },
  set: (val) => {
    localPageSize.value = val
  },
})

const customPageOption = computed({
  get: () => {
    if (pageSizeDefaults.includes(localPageSize.value)) {
      return localPageSize.value
    }
    return localPageSize.value.toString().concat(" / page")
  },
  set: (val) => {
    localPageSize.value = val
  }
})

const pageSizeRef = ref()

const pageSizeDropdownVisibleChange = (value: boolean) => {
  if (!value && pageSizeRef.value) {
    pageSizeRef.value?.blur()
  }
}

</script>

<template>
  <NcModal v-model:visible="dialogShow" :header="$t('labels.modifyPaginationLimit')" size="small" @keydown.esc="dialogShow = false">
    <template #header>
      <div class="flex flex-row items-center gap-x-2">
        <GeneralIcon icon="table" class="!text-gray-600/75" />
        {{ $t('labels.modifyPaginationLimit') }}
      </div>
    </template>
    <div class="nc-pagination flex flex-row items-center gap-x-2">
        <a-select ref="pageSizeRef" v-model:value="customPageOption" class="!min-w-[110px]" :options="pageSizeOptions"
            size="small" dropdown-class-name="nc-pagination-dropdown"
            @dropdown-visible-change="pageSizeDropdownVisibleChange">
            <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-500 nc-select-page-size-expand-btn" />
            </template>
        </a-select>
        <!-- Input and Button for entering a value -->
        <input v-model.lazy="customPageValue" type="number" placeholder="Set custom page size" size="small" />
    
    </div>
  </NcModal>
</template>

<style scoped lang="scss">
.nc-table-advanced-options {
  max-height: 0;
  transition: 0.3s max-height;
  overflow: hidden;

  &.active {
    max-height: 100px;
  }
}
</style>

