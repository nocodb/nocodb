<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'

interface Props {
  filter: ColumnFilterType
  nestedLevel: number

  column: ColumnType
  uidt: UITypes
  link: boolean
  webHook: boolean
  isLockedView: boolean
  showNullAndEmptyInFilter: boolean
  autoSave: boolean
  rootMeta?: any
  linkColId?: string
  parentColId?: string
  actionBtnType?: 'text' | 'secondary'
  filterOption?: (column: ColumnType) => boolean
  visibilityError?: Record<string, string>
  disableAddNewFilter?: boolean
  isViewFilter?: boolean
  readOnly?: boolean
  queryFilter?: boolean
}
interface Emits {
  (event: 'update:modelValue', model: string): void
  (event: 'change', model: { filter: ColumnFilterType; comparison_op: string }): void
}
const props = defineProps<Props>()
const emits = defineEmits<Emits>()
const filterVModel = useVModel(props, 'filter', emits)

const localNestedFilters = ref()

defineExpose({
  localNestedFilters,
})
</script>

<template>
  <div class="flex flex-col min-w-full w-min gap-y-2">
    <div class="flex rounded-lg p-2 min-w-full w-min border-1" :class="[`nc-filter-nested-level-${nestedLevel}`]">
      <LazySmartsheetToolbarColumnFilter
        v-if="filter.id || filter.children || !autoSave"
        ref="localNestedFilters"
        v-model="filterVModel.children"
        :nested-level="nestedLevel + 1"
        :parent-id="filter.id"
        :auto-save="autoSave"
        :web-hook="webHook"
        :link="link"
        :show-loading="false"
        :root-meta="rootMeta"
        :link-col-id="linkColId"
        :parent-col-id="parentColId"
        :filter-option="filterOption"
        :visibility-error="visibilityError"
        :disable-add-new-filter="disableAddNewFilter"
        :is-view-filter="isViewFilter"
        :read-only="readOnly"
      >
        <template #start>
          <span v-if="filter.status === 'delete'" class="flex items-center nc-filter-where-label ml-1">{{
            $t('labels.where')
          }}</span>
          <div v-else :key="`${i}nested`" class="flex nc-filter-logical-op">
            <NcSelect
              v-model:value="filter.logical_op"
              v-e="['c:filter:logical-op:select']"
              :dropdown-match-select-width="false"
              class="min-w-18 capitalize"
              placeholder="Group op"
              dropdown-class-name="nc-dropdown-filter-logical-op-group"
              :disabled="(i > 1 && !isLogicalOpChangeAllowed) || isLockedView || readOnly"
              :class="{
                'nc-disabled-logical-op': filter.readOnly || (i > 1 && !isLogicalOpChangeAllowed),
                '!max-w-18': !webHook,
                '!w-full': webHook,
              }"
              @click.stop
              @change="onLogicalOpUpdate(filter, i)"
            >
              <a-select-option v-for="op in logicalOps" :key="op.value" :value="op.value">
                <div class="flex items-center w-full justify-between w-full gap-2">
                  <div class="truncate flex-1 capitalize">{{ op.text }}</div>
                  <component
                    :is="iconMap.check"
                    v-if="filter.logical_op === op.value"
                    id="nc-selected-item-icon"
                    class="text-primary w-4 h-4"
                  />
                </div>
              </a-select-option>
            </NcSelect>
          </div>
        </template>
        <template #end>
          <NcButton
            v-if="!filter.readOnly && !readOnly"
            :key="i"
            v-e="['c:filter:delete', { link: !!link, webHook: !!webHook }]"
            type="text"
            size="small"
            :disabled="isLockedView"
            class="nc-filter-item-remove-btn cursor-pointer"
            @click.stop="deleteFilter(filter, i)"
          >
            <component :is="iconMap.deleteListItem" />
          </NcButton>
        </template>
      </LazySmartsheetToolbarColumnFilter>
    </div>
  </div>
</template>
