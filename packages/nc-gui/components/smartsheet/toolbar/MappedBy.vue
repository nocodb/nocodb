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
    ?.filter((el) => el.fk_column_id && metaColumnById.value[el.fk_column_id].uidt === UITypes.GeoData)
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
  <a-dropdown v-if="!IsPublic" v-model:visible="mappedByDropdown" :trigger="['click']" class="!xs:hidden">
    <div class="nc-map-btn">
      <a-button v-e="['c:map:change-grouping-field']" class="nc-map-stacked-by-menu-btn nc-toolbar-btn" :disabled="isLocked">
        <div class="flex items-center gap-1">
          <mdi-arrow-down-drop-circle-outline />
          <span class="text-capitalize !text-sm font-weight-normal">
            {{ $t('activity.map.mappedBy') }}
            <span class="font-bold">{{ geoDataFieldColumn?.title }}</span>
          </span>
          <component :is="iconMap.arrowDown" class="text-grey" />
        </div>
      </a-button>
    </div>
    <template #overlay>
      <div
        v-if="mappedByDropdown"
        class="p-3 min-w-[280px] bg-gray-50 shadow-lg nc-table-toolbar-menu max-h-[max(80vh,500px)] overflow-auto !border"
        @click.stop
      >
        <div>
          <span class="font-bold"> {{ $t('activity.map.chooseMappingField') }}</span>
          <a-divider class="!my-2" />
        </div>
        <div class="nc-fields-list py-1">
          <div class="grouping-field">
            <a-select
              v-model:value="geoDataMappingFieldColumnId"
              class="w-full nc-msp-grouping-field-select"
              :options="geoDataFieldOptions"
              placeholder="Select a Mapping Field"
              @change="handleChange"
              @click.stop
            />
          </div>
        </div>
      </div>
    </template>
  </a-dropdown>
</template>
