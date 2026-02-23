<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'
import type { ColumnType } from 'nocodb-sdk'

const meta = inject(MetaInj, ref())
const activeView = inject(ActiveViewInj, ref())
const IsPublic = inject(IsPublicInj, ref(false))
const isLocked = inject(IsLockedInj, ref(false))

const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)

const { timelineRange, loadTimelineData, timelineMetaData, viewMetaProperties } = useTimelineViewStoreOrThrow()

const { $api } = useNuxtApp()

const calendarRangeDropdown = ref(false)

// Get available date columns
const dateColumns = computed<ColumnType[]>(() => {
  return (meta.value?.columns ?? [])
    .filter((col) => {
      return [UITypes.Date, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(col.uidt as UITypes)
    })
    .sort((a, b) => {
      const priority: Record<string, number> = {
        [UITypes.DateTime]: 0,
        [UITypes.Date]: 1,
        [UITypes.CreatedTime]: 2,
        [UITypes.LastModifiedTime]: 3,
      }
      return (priority[a.uidt!] ?? 99) - (priority[b.uidt!] ?? 99)
    })
})

const selectedFromCol = ref<string | undefined>(timelineRange.value?.[0]?.fk_from_col?.id)
const selectedToCol = ref<string | undefined | null>(timelineRange.value?.[0]?.fk_to_col?.id ?? null)

watch(
  () => timelineRange.value,
  (val) => {
    if (val?.length) {
      selectedFromCol.value = val[0]?.fk_from_col?.id
      selectedToCol.value = val[0]?.fk_to_col?.id ?? null
    }
  },
  { immediate: true },
)

const isSetup = computed(() => {
  return !!selectedFromCol.value
})

const saveRange = async () => {
  if (!selectedFromCol.value || !activeView.value?.id) return

  try {
    const range = [
      {
        fk_from_column_id: selectedFromCol.value,
        fk_to_column_id: selectedToCol.value || null,
      },
    ]

    await $api.dbView.update(activeView.value.id, {
      timeline_range: range,
    } as any)

    await loadTimelineData()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const onFromChange = () => {
  selectedToCol.value = null
  saveRange()
}

// Initial view setting
const initialViewMode = computed({
  get: () => viewMetaProperties.value?.initial_view ?? 'closest_record',
  set: async (val: string) => {
    if (!activeView.value?.id) return
    try {
      const newMeta = { ...viewMetaProperties.value, initial_view: val }
      await $api.dbView.update(activeView.value.id, {
        meta: newMeta,
      } as any)
      if (timelineMetaData.value) {
        ;(timelineMetaData.value as any).meta = newMeta
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  },
})
</script>

<template>
  <NcDropdown
    v-if="!IsPublic"
    v-model:visible="calendarRangeDropdown"
    :trigger="['click']"
    class="!xs:hidden"
    overlay-class-name="nc-toolbar-dropdown overflow-hidden"
  >
    <NcTooltip :disabled="!isToolbarIconMode" class="nc-timeline-btn">
      <template #title>
        {{ $t('activity.settings') }}
      </template>

      <NcButton
        v-e="['c:timeline:change-timeline-range']"
        class="nc-toolbar-btn !border-0 group !h-7"
        size="small"
        type="secondary"
        data-testid="nc-timeline-range-btn"
        :show-as-disabled="isLocked"
      >
        <div class="flex items-center gap-2">
          <!-- #5: Use timeline icon instead of calendar icon -->
          <component :is="iconMap.timeline" class="h-4 w-4" />
          <span v-if="!isToolbarIconMode" class="text-capitalize !text-[13px] font-medium">
            {{ $t('activity.settings') }}
          </span>
        </div>
      </NcButton>
    </NcTooltip>

    <template #overlay>
      <div
        :class="{
          'nc-locked-view': isLocked,
        }"
      >
      <div
        v-if="calendarRangeDropdown"
        class="w-72 space-y-4 p-4"
        data-testid="nc-timeline-range-menu"
        @click.stop
      >
        <div class="flex flex-col w-full gap-2" data-testid="nc-timeline-range-option">
          <span class="text-nc-content-gray">
            {{ $t('labels.organiseBy') }}
          </span>

          <!-- Start Date Column -->
          <a-select
            v-model:value="selectedFromCol"
            class="nc-select-shadow w-full !rounded-lg"
            dropdown-class-name="!rounded-lg"
            :placeholder="$t('placeholder.notSelected')"
            data-testid="nc-timeline-range-from-field-select"
            :disabled="isLocked"
            @change="onFromChange"
            @click.stop
          >
            <template #suffixIcon>
              <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
            </template>
            <a-select-option v-for="col in dateColumns" :key="col.id" :value="col.id">
              <div class="w-full flex gap-2 items-center justify-between" :title="col.title">
                <div class="flex items-center gap-1 max-w-[calc(100%_-_20px)]">
                  <SmartsheetHeaderIcon :column="col" />
                  <NcTooltip class="flex-1 max-w-[calc(100%_-_20px)] truncate" show-on-truncate-only>
                    <template #title>{{ col.title }}</template>
                    <template #default>{{ col.title }}</template>
                  </NcTooltip>
                </div>
                <GeneralIcon
                  v-if="col.id === selectedFromCol"
                  id="nc-selected-item-icon"
                  icon="check"
                  class="flex-none text-primary w-4 h-4"
                />
              </div>
            </a-select-option>
          </a-select>

          <!-- End Date -->
          <div class="w-full space-y-2">
            <NcButton
              v-if="selectedToCol === null"
              size="small"
              data-testid="nc-timeline-range-add-end-date"
              type="text"
              :shadow="false"
              :disabled="isLocked"
              @click="selectedToCol = undefined"
            >
              <div class="flex gap-2 items-center">
                <component :is="iconMap.plus" class="h-4 w-4" />
                {{ $t('activity.endDate') }}
              </div>
            </NcButton>
            <template v-else>
              <span class="text-nc-content-gray">
                {{ $t('activity.withEndDate') }}
              </span>
              <div class="flex">
                <a-select
                  v-model:value="selectedToCol"
                  class="nc-select-shadow w-full flex-1 !rounded-lg"
                  allow-clear
                  :disabled="!selectedFromCol || isLocked"
                  :placeholder="$t('placeholder.notSelected')"
                  data-testid="nc-timeline-range-to-field-select"
                  dropdown-class-name="!rounded-lg"
                  @change="saveRange"
                  @click.stop
                >
                  <template #suffixIcon>
                    <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
                  </template>
                  <a-select-option
                    v-for="col in dateColumns.filter((c) => c.id !== selectedFromCol)"
                    :key="col.id"
                    :value="col.id"
                  >
                    <div class="w-full flex gap-2 items-center justify-between" :title="col.title">
                      <div class="flex items-center gap-1 max-w-[calc(100%_-_20px)]">
                        <SmartsheetHeaderIcon :column="col" />
                        <NcTooltip class="flex-1 max-w-[calc(100%_-_20px)] truncate" show-on-truncate-only>
                          <template #title>{{ col.title }}</template>
                          <template #default>{{ col.title }}</template>
                        </NcTooltip>
                      </div>
                      <GeneralIcon
                        v-if="col.id === selectedToCol"
                        id="nc-selected-item-icon"
                        icon="check"
                        class="flex-none text-primary w-4 h-4"
                      />
                    </div>
                  </a-select-option>
                </a-select>
              </div>
            </template>
          </div>
        </div>

        <!-- Initial view setting -->
        <div class="flex flex-col w-full gap-2">
          <span class="text-nc-content-gray">
            {{ $t('labels.initialView') }}
          </span>
          <a-select
            :value="initialViewMode"
            class="nc-select-shadow w-full !rounded-lg"
            dropdown-class-name="!rounded-lg"
            :disabled="isLocked"
            data-testid="nc-timeline-initial-view-select"
            @change="(val: string) => (initialViewMode = val)"
            @click.stop
          >
            <template #suffixIcon>
              <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
            </template>
            <a-select-option value="closest_record">
              <div class="w-full flex gap-2 items-center justify-between">
                <span>{{ $t('labels.closestRecordToToday') }}</span>
                <GeneralIcon
                  v-if="initialViewMode === 'closest_record'"
                  id="nc-selected-item-icon"
                  icon="check"
                  class="flex-none text-primary w-4 h-4"
                />
              </div>
            </a-select-option>
            <a-select-option value="today">
              <div class="w-full flex gap-2 items-center justify-between">
                <span>{{ $t('labels.today') }}</span>
                <GeneralIcon
                  v-if="initialViewMode === 'today'"
                  id="nc-selected-item-icon"
                  icon="check"
                  class="flex-none text-primary w-4 h-4"
                />
              </div>
            </a-select-option>
          </a-select>
        </div>

        <!-- #9: i18n warning message -->
        <div v-if="!isSetup" class="flex items-center gap-2 !mt-2">
          <GeneralIcon icon="warning" class="text-sm mt-0.5 text-nc-content-orange-medium" />
          <span class="text-sm text-nc-content-gray-muted">
            {{ $t('msg.dateFieldRequired') }}
          </span>
        </div>

      </div>
      <GeneralLockedViewFooter v-if="isLocked" @on-open="calendarRangeDropdown = false" />
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss">
.nc-to-select .ant-select-selector {
  @apply !rounded-r-none;
}
</style>
