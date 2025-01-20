<script setup lang="ts">
import { type ColumnType, isLinksOrLTAR, isVirtualCol } from 'nocodb-sdk'

const props = defineProps<{
  store: ReturnType<typeof useProvideExpandedFormStore>
  fields: ColumnType[]
  forceVerticalMode?: boolean
  isLoading: boolean
}>()

const { changedColumns, isNew, loadRow: _loadRow, row: _row } = props.store
const isPublic = inject(IsPublicInj, ref(false))

const { isUIAllowed } = useRoles()

const readOnly = computed(() => !isUIAllowed('dataEdit') || isPublic.value)

const shouldApplyDataCell = (column: ColumnType) =>
  !(isBarcode(column) || isQrCode(column) || isBoolean(column) || isRating(column) || isJSON(column))
</script>

<template>
  <div
    v-for="col of fields"
    v-show="!isVirtualCol(col) || !isNew || isLinksOrLTAR(col)"
    :key="col.title"
    :class="`nc-expand-col-${col.title}`"
    :col-id="col.id"
    :data-testid="`nc-expand-col-${col.title}`"
    class="nc-expanded-form-row w-full"
  >
    <div
      class="flex items-start nc-expanded-cell min-h-[32px]"
      :class="{
        'flex-row sm:(gap-x-2) <lg:(flex-col w-full)': !props.forceVerticalMode,
        'flex-col w-full': props.forceVerticalMode,
      }"
    >
      <div
        class="flex items-center rounded-lg overflow-hidden"
        :class="{
          'w-45 <lg:(w-full px-0 mb-1) h-[32px] xs:(h-auto)': !props.forceVerticalMode,
          'w-full px-0 mb-1 h-auto': props.forceVerticalMode,
        }"
      >
        <LazySmartsheetHeaderVirtualCell
          v-if="isVirtualCol(col)"
          :column="col"
          class="nc-expanded-cell-header h-full flex-none"
        />
        <LazySmartsheetHeaderCell v-else :column="col" class="nc-expanded-cell-header flex-none" />
      </div>

      <a-skeleton-input
        v-if="isLoading"
        active
        class="h-8 flex-none <lg:!w-full lg:flex-1 !rounded-lg !overflow-hidden"
        size="small"
      />
      <NcTooltip v-else class="w-full" placement="right" :disabled="!isReadOnlyVirtualCell(col)">
        <template #title>{{ $t('msg.info.fieldReadonly') }}</template>
        <SmartsheetDivDataCell
          v-if="col.title"
          class="bg-white flex-1 <lg:w-full px-1 min-h-8 flex items-center relative"
          :class="{
            'w-full': props.forceVerticalMode,
            '!select-text nc-system-field bg-nc-bg-gray-extralight !text-nc-content-inverted-primary-disabled cursor-pointer':
              isReadOnlyVirtualCell(col) && shouldApplyDataCell(col),
            '!select-text nc-readonly-div-data-cell': readOnly,
          }"
          :is-data-cell="shouldApplyDataCell(col)"
        >
          <LazySmartsheetVirtualCell
            v-if="isVirtualCol(col)"
            v-model="_row.row[col.title]"
            :column="col"
            :read-only="readOnly"
            :row="_row"
          />

          <LazySmartsheetCell
            v-else
            v-model="_row.row[col.title]"
            :active="true"
            :column="col"
            :edit-enabled="true"
            :read-only="readOnly"
            @update:model-value="changedColumns.add(col.title)"
          />
        </SmartsheetDivDataCell>
      </NcTooltip>
    </div>
  </div>
</template>
