<script setup lang="ts">
import type { MapType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import type { SelectProps } from 'ant-design-vue'

const { eventBus } = useSmartsheetStoreOrThrow()

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj, ref(false))

const IsPublic = inject(IsPublicInj, ref(false))

const { fields, loadViewColumns, metaColumnById } = useViewColumnsOrThrow()

const { loadMapData, loadMapMeta, updateMapMeta, mapMetaData, geoDataFieldColumn } = useMapViewStoreOrThrow()

const mappedByDropdown = ref(false)

watch(
  () => activeView.value?.id,
  async (newVal, oldVal) => {
    if (newVal !== oldVal && meta.value) {
      await loadViewColumns()
    }
  },
  { immediate: true },
)

const geoDataMappingFieldColumnId = computed({
  get: () => mapMetaData.value.fk_geo_data_col_id,
  set: async (val) => {
    if (val) {
      await updateMapMeta({
        fk_geo_data_col_id: val,
      })
      await loadMapMeta()
      await loadMapData()
      ;(activeView.value?.view as MapType).fk_geo_data_col_id = val
      eventBus.emit(SmartsheetStoreEvents.MAPPED_BY_COLUMN_CHANGE)
    }
  },
})

const geoDataFieldOptions = computed<SelectProps['options']>(() => {
  return fields.value
    ?.filter((el) => el.fk_column_id && metaColumnById.value[el.fk_column_id]?.uidt === UITypes.GeoData)
    .map((field) => {
      return {
        value: field.fk_column_id,
        label: field.title,
      }
    })
})

const handleChange = () => {
  mappedByDropdown.value = false
}
</script>

<template>
  <NcDropdown
    v-if="!IsPublic"
    v-model:visible="mappedByDropdown"
    :trigger="['click']"
    overlay-class-name="nc-dropdown-mapped-by-menu overflow-hidden"
    class="!xs:hidden"
  >
    <div class="nc-map-btn">
      <NcButton
        v-e="['c:map:change-grouping-field']"
        class="nc-map-stacked-by-menu-btn nc-toolbar-btn !border-0 !h-7 group"
        size="small"
        type="secondary"
        :show-as-disabled="isLocked"
      >
        <div class="flex items-center gap-2">
          <GeneralIcon icon="settings" class="h-4 w-4" />
          <div class="flex items-center gap-0.5">
            <span class="text-capitalize !text-[13px] font-medium flex items-center gap-1">
              {{ $t('activity.map.mappedBy') }}
            </span>
            <div
              class="flex items-center rounded-md transition-colors duration-0.3s bg-nc-bg-gray-light px-1 min-h-5 max-w-[108px]"
              :class="{
                'group-hover:bg-nc-bg-gray-medium': !isLocked,
              }"
            >
              <span class="!text-[13px] font-medium truncate !leading-5">{{ geoDataFieldColumn?.title }}</span>
            </div>
          </div>
        </div>
      </NcButton>
    </div>
    <template #overlay>
      <div
        v-if="mappedByDropdown"
        class="p-4 w-90 bg-nc-bg-default nc-table-toolbar-menu rounded-lg flex flex-col gap-5"
        @click.stop
      >
        <div class="flex flex-col gap-2">
          <div>
            {{ $t('activity.map.chooseMappingField') }}
          </div>
          <div class="nc-fields-list">
            <div class="grouping-field">
              <a-select
                v-model:value="geoDataMappingFieldColumnId"
                class="nc-select-shadow w-full nc-map-grouping-field-select !rounded-lg"
                dropdown-class-name="!rounded-lg"
                placeholder="Select a Mapping Field"
                :disabled="isLocked"
                @change="handleChange"
                @click.stop
              >
                <template #suffixIcon><GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" /></template>
                <a-select-option v-for="option of geoDataFieldOptions" :key="option.value" :value="option.value">
                  <div class="w-full flex gap-2 items-center justify-between" :title="option.label">
                    <div class="flex items-center gap-1 max-w-[calc(100%_-_20px)]">
                      <SmartsheetHeaderIcon
                        v-if="option.value && metaColumnById[option.value]"
                        :column="metaColumnById[option.value]"
                        class="!w-3.5 !h-3.5 opacity-80 !ml-0"
                        color="text-current"
                      />
                      <NcTooltip class="flex-1 max-w-[calc(100%_-_20px)] truncate" show-on-truncate-only>
                        <template #title>
                          {{ option.label }}
                        </template>
                        <template #default>{{ option.label }}</template>
                      </NcTooltip>
                    </div>
                    <GeneralIcon
                      v-if="geoDataMappingFieldColumnId === option.value"
                      id="nc-selected-item-icon"
                      icon="check"
                      class="flex-none text-primary w-4 h-4"
                    />
                  </div>
                </a-select-option>
              </a-select>
            </div>
          </div>
        </div>
        <GeneralLockedViewFooter v-if="isLocked" class="-mb-4 -mx-4" @on-open="mappedByDropdown = false" />
      </div>
    </template>
  </NcDropdown>
</template>
