<script lang="ts" setup>
import { UITypes, isSystemColumn } from 'nocodb-sdk'
import type { SelectProps } from 'ant-design-vue'
import {
  ActiveViewInj,
  IsLockedInj,
  IsPublicInj,
  MetaInj,
  computed,
  iconMap,
  inject,
  ref,
  useViewColumnsOrThrow,
  watch,
} from '#imports'

const meta = inject(MetaInj, ref())

const { $api } = useNuxtApp()

const activeView = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj, ref(false))

const IsPublic = inject(IsPublicInj, ref(false))

const { loadViewColumns } = useViewColumnsOrThrow()

const { loadCalendarMeta, loadCalendarData, loadSidebarData } = useCalendarViewStoreOrThrow()

const calendarRangeDropdown = ref(false)

watch(
  () => activeView.value?.id,
  async (newVal, oldVal) => {
    if (newVal !== oldVal && meta.value) {
      await loadViewColumns()
    }
  },
  { immediate: true },
)

const calendarRange = computed<{ fk_from_column_id: string; fk_to_column_id: string | null }[]>(() => {
  const tempCalendarRange: { fk_from_column_id: string; fk_to_column_id: string | null }[] = []

  if (!activeView.value || !activeView.value.view) return tempCalendarRange
  activeView.value.view.calendar_range?.forEach((range) => {
    tempCalendarRange.push({
      fk_from_column_id: range.fk_from_column_id,
      fk_to_column_id: range.fk_to_column_id,
    })
  })
  return tempCalendarRange
})

// We keep the calendar range here and update it when the user selects a new range
const _calendar_ranges = ref<{ fk_from_column_id: string; fk_to_column_id: string | null }[]>(calendarRange.value)

const saveCalendarRanges = async () => {
  if (activeView.value) {
    try {
      const calRanges = _calendar_ranges.value
        .filter((range) => range.fk_from_column_id)
        .map((range) => ({
          fk_from_column_id: range.fk_from_column_id,
          fk_to_column_id: range.fk_to_column_id,
        }))
      await $api.dbView.calendarUpdate(activeView.value?.id as string, {
        calendar_range: calRanges as { fk_from_column_id: string; fk_to_column_id: string | null }[],
      })
      await loadCalendarMeta()
      await Promise.all([loadCalendarData(), loadSidebarData()])
    } catch (e) {
      console.log(e)
      message.error('There was an error while updating view!')
    }
  } else {
    message.error('Please select a view first')
  }
}

const dateFieldOptions = computed<SelectProps['options']>(() => {
  return (
    meta.value?.columns
      ?.filter((c) => c.uidt === UITypes.Date || (c.uidt === UITypes.DateTime && !isSystemColumn(c)))
      .map((c) => ({
        label: c.title,
        value: c.id,
        uidt: c.uidt,
      })) ?? []
  )
})

// To add new calendar range
const addCalendarRange = async () => {
  _calendar_ranges.value.push({
    fk_from_column_id: dateFieldOptions.value[0].value,
    fk_to_column_id: null,
  })
  await saveCalendarRanges()
}

const removeRange = async (id: number) => {
  _calendar_ranges.value = _calendar_ranges.value.filter((_, i) => i !== id)

  await saveCalendarRanges()
}
</script>

<template>
  <NcDropdown v-if="!IsPublic" v-model:visible="calendarRangeDropdown" :trigger="['click']" class="!xs:hidden">
    <div class="nc-calendar-btn">
      <a-button
        v-e="['c:calendar:change-calendar-range']"
        :disabled="isLocked"
        class="nc-toolbar-btn"
        data-testid="nc-calendar-range-btn"
      >
        <div class="flex items-center gap-2">
          <component :is="iconMap.calendar" class="h-4 w-4" />
          <span class="text-capitalize !text-sm font-medium">
            {{ $t('activity.viewSettings') }}
          </span>
        </div>
      </a-button>
    </div>
    <template #overlay>
      <div v-if="calendarRangeDropdown" class="w-full p-6 w-[35rem]" data-testid="nc-calendar-range-menu" @click.stop>
        <div v-for="(range, id) in _calendar_ranges" :key="id" class="flex w-full gap-2 mb-2 items-center">
          <span>
            {{ $t('labels.organiseBy') }}
          </span>
          <NcSelect
            v-model:value="range.fk_from_column_id"
            :placeholder="$t('placeholder.notSelected')"
            @change="saveCalendarRanges"
          >
            <a-select-option
              v-for="(option, opId) in [...dateFieldOptions].filter((r) => {
                if (id === 0) return true
                const firstRange = dateFieldOptions.find((f) => f.value === calendarRange[0].fk_from_column_id)
                return firstRange?.uidt === r.uidt
              })"
              :key="opId"
              :value="option.value"
            >
              <div class="flex items-center">
                <SmartsheetHeaderIcon :column="option" />
                <NcTooltip class="truncate flex-1 max-w-18" placement="top" show-on-truncate-only>
                  <template #title>{{ option.label }}</template>
                  {{ option.label }}
                </NcTooltip>
              </div>
            </a-select-option>
          </NcSelect>

          <div
            v-if="range.fk_to_column_id === null && isEeUI && false"
            class="flex cursor-pointer flex text-gray-800 items-center gap-1"
            @click="
              () => {
                range.fk_to_column_id = undefined
                saveCalendarRanges()
              }
            "
          >
            <component :is="iconMap.plus" class="h-4 w-4" />
            {{ $t('activity.addEndDate') }}
          </div>
          <template v-else-if="isEeUI && false">
            <span>
              {{ $t('activity.withEndDate') }}
            </span>
            <div class="flex">
              <NcSelect
                v-model:value="range.fk_to_column_id"
                :disabled="!range.fk_from_column_id"
                :placeholder="$t('placeholder.notSelected')"
                class="!rounded-r-none nc-to-select"
                @change="saveCalendarRanges"
              >
                <a-select-option
                  v-for="(option, opId) in [...dateFieldOptions].filter((f) => {
                    const firstRange = dateFieldOptions.find((f) => f.value === calendarRange[0].fk_from_column_id)
                    return firstRange?.uidt === f.uidt
                  })"
                  :key="opId"
                  :value="option.value"
                >
                  <div class="flex items-center">
                    <SmartsheetHeaderIcon :column="option" />
                    <NcTooltip class="truncate flex-1 max-w-18" placement="top" show-on-truncate-only>
                      <template #title>{{ option.label }}</template>
                      {{ option.label }}
                    </NcTooltip>
                  </div>
                </a-select-option>
              </NcSelect>
              <NcButton
                class="!rounded-l-none !border-l-0"
                size="small"
                type="secondary"
                @click="
                  () => {
                    range.fk_to_column_id = null
                    saveCalendarRanges()
                  }
                "
              >
                <component :is="iconMap.delete" class="h-4 w-4" />
              </NcButton>
            </div>
          </template>
          <NcButton v-if="id !== 0" size="small" type="secondary" @click="removeRange(id)">
            <component :is="iconMap.close" />
          </NcButton>
        </div>
        <NcButton v-if="false" class="mt-2" size="small" type="secondary" @click="addCalendarRange">
          <component :is="iconMap.plus" />
          Add another date field
        </NcButton>
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped>
.nc-to-select .ant-select-selector {
  @apply !rounded-r-none;
}
</style>
