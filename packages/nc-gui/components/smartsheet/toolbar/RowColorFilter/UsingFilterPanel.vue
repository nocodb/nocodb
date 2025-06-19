<script lang="ts" setup>
import type { ClientType } from 'nocodb-sdk'

interface Props {
  modelValue?: RowColorFilterType[]
  columns: ColumnTypeForFilter[]
  filtersCount: number
  filterPerViewLimit: number
  disabled?: boolean
  isLockedView?: boolean
  disableAddNewFilter?: boolean
  dbClientType?: ClientType
}

interface Emits {
  (event: 'change', model: FilterGroupChangeEvent): void
  (event: 'removeAll', model: { prevValue: RowColorFilterType[] }): void
}

const props = defineProps<Props>()
const emits = defineEmits<Emits>()

const vModel = useVModel(props, 'modelValue', emits)

const onAddColorCondition = () => {
  const prevValue = [...vModel.value]
  const addedFilter = {
    is_group: true,
    color: theme.light[vModel.value?.length % theme.light.length],
    isSetAsBackground: false,
    children: [
      {
        is_group: false,
      },
    ],
  }
  vModel.value!.push(addedFilter)
  emits('change', {
    filter: addedFilter,
    filters: [...vModel.value],
    index: prevValue.length,
    type: 'delete',
    value: addedFilter,
    prevValue,
  })
}
const removeColor = (index: number) => {
  const prevValue = [...vModel.value]
  const deletedColor = vModel.value?.splice(index, 1)
  emits('change', {
    filter: deletedColor,
    filters: [...vModel.value],
    index,
    type: 'delete',
    value: deletedColor,
    prevValue,
  })
  if (vModel.value?.length === 0) {
    emits('removeAll', {
      prevValue,
    })
  }
}
</script>

<template>
  <div class="min-w-[640px] w-auto inline-block h-auto rounded-2xl bg-white p-4">
    <div class="flex flex-col gap-3">
      <template v-for="(rowColorConfig, i) in vModel" :key="i">
        <div>
          <!-- index here is 0, since we evaluate the logic op individually per color -->
          <SmartsheetToolbarFilterGroup
            v-model="rowColorConfig.children"
            :fk-parent-id="rowColorConfig.id"
            :index="0"
            :nested-level="0"
            :columns="columns"
            :disabled="disabled || isLockedView"
            :is-locked-view="false"
            :is-logical-op-change-allowed="false"
            :web-hook="false"
            :link="false"
            :is-form="true"
            :is-public="false"
            :is-full-width="true"
            :filter-per-view-limit="filterPerViewLimit"
            :disable-add-new-filter="disableAddNewFilter"
            action-btn-type="text"
            :filters-count="filtersCount"
            :db-client-type="dbClientType"
            :query-filter="false"
          >
            <template #root-header>
              <div class="flex justify-between w-full pb-2">
                <div class="flex-grow">
                  <template v-if="!disabled && !isLockedView">
                    <GeneralAdvanceColorPickerDropdown v-model="rowColorConfig.color">
                      <NcButton
                        type="text"
                        size="small"
                        :style="{
                          'background-color': rowColorConfig.color,
                        }"
                      >
                        <span
                          :style="{
                            color: getOppositeColorOfBackground(rowColorConfig.color),
                          }"
                        >
                          <component :is="iconMap.chevronDown" />
                        </span>
                      </NcButton>
                    </GeneralAdvanceColorPickerDropdown>
                  </template>
                  <template v-else>
                    <NcButton
                      type="text"
                      size="small"
                      :style="{
                        'background-color': getLighterTint(rowColorConfig.color, { saturationMod: 15 }),
                      }"
                      :disabled="true"
                    >
                    </NcButton>
                  </template>
                </div>
                <div class="justify-end">
                  <NcButton
                    v-if="!disabled"
                    type="text"
                    size="small"
                    class="nc-filter-item-remove-btn cursor-pointer"
                    :disabled="isLockedView"
                    @click="removeColor(i)"
                  >
                    <component :is="iconMap.deleteListItem" />
                  </NcButton>
                </div>
              </div>
            </template>

            <template #root-add-filter-row>
              <div class="flex-grow flex justify-end items-center">
                <NcSwitch v-model:checked="rowColorConfig.isSetAsBackground" @change=""> Background color </NcSwitch>
              </div>
            </template>
          </SmartsheetToolbarFilterGroup>
        </div>
      </template>
      <div>
        <NcButton type="text" size="small" class="hover:!text-brand-500 hover:!bg-transparent" @click="onAddColorCondition">
          <template #icon>
            <component :is="iconMap.plus" />
          </template>
          Add Color
        </NcButton>
      </div>
    </div>
  </div>
</template>
