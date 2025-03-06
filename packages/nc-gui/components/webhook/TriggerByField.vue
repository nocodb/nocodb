<script setup lang="ts">
import { renderIcon } from '~/components/smartsheet/header/VirtualCellIcon'
interface Props {
  columns: ColumnType[]
  selectedColumns: string[]
  onChange: (selectedColumns: string[]) => void
}

const props = defineProps<Props>()

const searchColumnText = ref('')
const isDropdownOpen = ref(false)
const dropdownRef = templateRef('dropdown')
const columnOptions = computed(() => {
  if (searchColumnText.value === '') {
    return props.columns
  } else {
    return props.columns.filter((k) => {
      return k.title.match(new RegExp(searchColumnText.value, 'i')) !== null
    })
  }
})
const toggleColumn = (col: ColumnType) => {
  if (props.selectedColumns.includes(col.id)) {
    props.onChange(props.selectedColumns.filter((k) => k !== col.id))
  } else {
    props.onChange([col.id, ...props.selectedColumns])
  }
}
const removeColumnId = (colId: string) => {
  props.onChange(props.selectedColumns.filter((k) => k !== colId))
}
onClickOutside(dropdownRef, (e) => {
  if (isDropdownOpen.value) {
    isDropdownOpen.value = false
  }
})
watch(() => {
  if (!isDropdownOpen.value) {
    searchColumnText.value = ''
  }
})
</script>

<template>
  <div class="pb-3">
    <a-dropdown :visible="isDropdownOpen">
      <NcButton type="secondary" @click="isDropdownOpen = true"><GeneralIcon icon="plus"></GeneralIcon> Add</NcButton>
      <template #overlay>
        <a-card ref="dropdown">
          <div class="flex px-2 py-1">
            <a-input v-model:value="searchColumnText" :bordered="false" :placeholder="$t('general.search')">
              <template #prefix><GeneralIcon icon="search" class="mr-2"> </GeneralIcon></template>
            </a-input>
          </div>
          <a-divider style="margin: 4px 0" />
          <div v-for="col of columnOptions" :key="col.id">
            <a-button type="text" class="w-full" style="box-shadow: none" @click="toggleColumn(col)">
              <div class="w-full flex gap-2" style="justify-content: space-between">
                <div class="pr-1">
                  <component :is="renderIcon(col).icon" class="max-h-[16px]" />
                </div>
                <div class="flex-grow text-left pr-2">
                  {{ col.title }}
                </div>
                <div class="flex flex-shrink max-w-[18px]">
                  <a-checkbox :checked="!!selectedColumns.includes(col.id)" :readonly="true"></a-checkbox>
                </div>
              </div>
            </a-button>
          </div>
        </a-card>
      </template>
    </a-dropdown>
    <div class="pt-1">
      <a-tag v-for="colId of selectedColumns" :key="colId" :closable="true"  @close="removeColumnId(colId)">
        <template v-for="col of [columnOptions.find((k) => k.id === colId)]" :key="col.id">
          <component :is="renderIcon(col).icon" class="max-h-[16px]" />
          {{ col.title }}
        </template>
      </a-tag>
    </div>
  </div>
</template>
