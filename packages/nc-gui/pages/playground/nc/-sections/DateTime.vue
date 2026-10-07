<script setup lang="ts">
import dayjs from 'dayjs'
import PgDemo from '../../-components/PgDemo.vue'
import PgSection from '../../-components/PgSection.vue'

const PICKER_TYPES = ['date', 'month', 'year'] as const

const selected = ref<dayjs.Dayjs | null>(dayjs())

const pageDate = ref(dayjs())

const pickerType = ref<(typeof PICKER_TYPES)[number]>('date')

const time = ref<dayjs.Dayjs | null>(dayjs().hour(14).minute(30))

const weekSelected = ref<dayjs.Dayjs | null>(dayjs())

const weekPage = ref(dayjs())

const selectedWeek = ref({ start: dayjs().startOf('week'), end: dayjs().endOf('week') })

const monthSelected = ref<dayjs.Dayjs | null>(dayjs())

const monthPage = ref(dayjs())

const dueAt = ref<string | null>(dayjs().add(3, 'day').format('YYYY-MM-DD HH:mm:ss'))

const launchDate = ref<string | null>(null)

const activeDates = [dayjs().subtract(2, 'day'), dayjs().add(1, 'day'), dayjs().add(5, 'day')]
</script>

<template>
  <PgSection
    id="datetime"
    title="Date & time pickers"
    source="NcDatePicker · NcDateTimePicker · NcTimeSelector · NcDateWeekSelector · NcMonthYearSelector"
  >
    <PgDemo label="NcDateTimePicker" hint="input + dropdown, as used in filters and forms">
      <div class="flex flex-wrap items-center gap-4">
        <NcDateTimePicker v-model="dueAt" placeholder="Pick date & time" class="w-72" />
        <NcDateTimePicker v-model="launchDate" type="date" placeholder="Pick a date" class="w-56" />
        <NcDateTimePicker model-value="2026-01-01 09:00:00" disabled class="w-72" />
      </div>
    </PgDemo>

    <div class="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
      <PgDemo label="NcDatePicker" :hint="`type: ${pickerType}`">
        <template #actions>
          <NcSelect v-model:value="pickerType" size="small" class="w-24">
            <a-select-option v-for="t in PICKER_TYPES" :key="t" :value="t">{{ t }}</a-select-option>
          </NcSelect>
        </template>
        <div class="pg-dropdown-overlay w-[256px] mx-auto">
          <NcDatePicker
            v-model:selected-date="selected"
            v-model:page-date="pageDate"
            :type="pickerType"
            size="medium"
            is-open
            show-current-date-option
          />
        </div>
        <div class="text-captionSm text-nc-content-gray-muted mt-2 text-center">{{ selected?.format('YYYY-MM-DD') ?? '—' }}</div>
      </PgDemo>

      <PgDemo label="NcDateWeekSelector" hint="calendar side menu, week mode">
        <div class="pg-side-panel w-[288px] mx-auto">
          <NcDateWeekSelector
            v-model:selected-date="weekSelected"
            v-model:page-date="weekPage"
            v-model:selected-week="selectedWeek"
            :active-dates="activeDates"
            is-week-picker
            size="medium"
            header="v2"
          />
        </div>
        <div class="text-captionSm text-nc-content-gray-muted mt-2 text-center">
          {{ selectedWeek.start.format('MMM D') }} – {{ selectedWeek.end.format('MMM D') }}
        </div>
      </PgDemo>

      <PgDemo label="NcMonthYearSelector" hint="calendar side menu, month mode">
        <div class="pg-side-panel w-[288px] mx-auto">
          <NcMonthYearSelector v-model:selected-date="monthSelected" v-model:page-date="monthPage" size="medium" header="v2" />
        </div>
      </PgDemo>

      <PgDemo label="NcMonthYearSelector (year)" hint="calendar side menu, year mode">
        <div class="pg-side-panel w-[288px] mx-auto">
          <NcMonthYearSelector
            v-model:selected-date="monthSelected"
            v-model:page-date="monthPage"
            size="medium"
            header="v2"
            is-year-picker
          />
        </div>
      </PgDemo>

      <PgDemo label="NcTimeSelector" hint="30-min granularity, as in the Time cell">
        <div class="pg-dropdown-overlay w-[160px] mx-auto">
          <NcTimeSelector v-model:selected-date="time" is-min-granularity-picker :min-granularity="30" is-open />
        </div>
      </PgDemo>

      <PgDemo label="NcTimeSelector (12h)" hint="is12hr-format + current-date option">
        <!-- the list only renders with is-min-granularity-picker -->
        <div class="pg-dropdown-overlay w-[160px] mx-auto">
          <NcTimeSelector
            v-model:selected-date="time"
            is-min-granularity-picker
            :min-granularity="30"
            is12hr-format
            is-open
            show-current-date-option
          />
        </div>
      </PgDemo>
    </div>
  </PgSection>
</template>

<style scoped lang="scss">
.pg-dropdown-overlay {
  @apply rounded-lg border-1 border-nc-border-gray-medium shadow-lg bg-nc-bg-default overflow-hidden;
}

.pg-side-panel {
  @apply rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default overflow-hidden;
}
</style>
