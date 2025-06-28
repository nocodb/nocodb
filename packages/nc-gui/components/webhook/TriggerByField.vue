<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { isVirtualCol } from 'nocodb-sdk'
interface Props {
  columns: ColumnType[]
  triggerFields: string[]
}

const props = defineProps<Props>()

const emits = defineEmits(['update:selectedColumns'])

const columns = toRef(props, 'columns')

const triggerFields = useVModel(props, 'triggerFields', emits)

const isDropdownOpen = ref(false)

const computedTags = computed(() => {
  return triggerFields.value.map((colId) => {
    return columns.value.find((k) => k.id === colId)
  })
})

const removeColumnId = (colId: string) => {
  triggerFields.value = triggerFields.value.filter((k) => k !== colId)
}
</script>

<template>
  <div class="my-3">
    <NcDropdown v-model:visible="isDropdownOpen" overlay-class-name="!pt-0">
      <NcButton size="small" type="secondary">
        <div class="flex items-center justify-center gap-2">
          <GeneralIcon icon="plus" />
          Add
        </div>
      </NcButton>
      <template #overlay>
        <NcList
          v-model:value="triggerFields"
          v-model:open="isDropdownOpen"
          class="nc-list-field"
          is-multi-select
          :close-on-select="false"
          :list="columns"
          :item-height="30"
          option-value-key="id"
          option-label-key="title"
        >
          <template #headerExtraRight>
            <NcBadge :border="false" color="brand"> {{ triggerFields.length }} fields </NcBadge>
          </template>

          <template #listItem="{ option }">
            <div class="flex items-center w-full truncate gap-3">
              <SmartsheetHeaderVirtualCellIcon v-if="isVirtualCol(option)" :column-meta="option" />
              <SmartsheetHeaderCellIcon v-else :column-meta="option" />

              <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                <template #title>
                  {{ option?.title }}
                </template>
                <div class="flex-1 text-nc-content-gray font-semibold leading-5 text-[13px]">
                  {{ option?.title }}
                </div>
              </NcTooltip>

              <NcCheckbox :checked="!!triggerFields.includes(option.id)" />
            </div>
          </template>
        </NcList>
      </template>
    </NcDropdown>

    <div v-if="triggerFields?.length" class="mt-3 gap-2 flex flex-wrap">
      <div
        v-for="col of computedTags"
        :key="col.id"
        class="bg-nc-bg-gray-medium text-nc-content-gray-subtle2 px-1 py-0.5 rounded-md flex gap-1 items-center"
      >
        <SmartsheetHeaderVirtualCellIcon v-if="isVirtualCol(col)" :column-meta="col" />
        <SmartsheetHeaderCellIcon v-else :column-meta="col" />
        <div class="text-[13px] font-medium leading-4.5">
          {{ col.title }}
        </div>

        <div class="w-0.25 h-4 bg-nc-border-gray-dark" />

        <GeneralIcon class="cursor-pointer" icon="close" @click="removeColumnId(col.id)" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-list-field {
  .nc-list-root {
    @apply !pt-0;
  }

  .nc-search-icon {
    @apply text-nc-content-gray-muted !w-4 !h-4;
  }

  :deep(.nc-list-item) {
    @apply !p-1;
    .ant-checkbox-checked .ant-checkbox-inner {
      background-color: #3366FF !important;
      border-color: #3366FF !important;
    }
  }

  :deep(.nc-list-search-wrapper) {
    @apply !px-3 !py-1;

    .nc-toolbar-dropdown-search-field-input {
      @apply !p-0;
    }

    :deep(.nc-divider) {
      @apply !my-1;
    }
  }
}
.nc-dropdown {
  [prefixcls='ant-dropdown-menu'] {
    @apply !pt-1;
  }
}
</style>
