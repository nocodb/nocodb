<script setup lang="ts">
import { ColumnHelper, UITypes, dateFormats, timeFormats } from 'nocodb-sdk'
import { type TimeZone, getTimeZones } from '@vvo/tzdb'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const timezones = getTimeZones({ includeUtc: true }).sort((a, b) => a.name.localeCompare(b.name))
const browserTzName = Intl.DateTimeFormat().resolvedOptions().timeZone
const browserTz = timezones.find((tz) => isSameTimezone(tz.name, browserTzName))
const utcTz = timezones.find((tz) => tz.name === 'Etc/UTC')
const defaultSuggestedTzs = [browserTz, utcTz].filter((k) => k) as TimeZone[]

const priorityTzs = computed(() => {
  const otherPriorityTzs = []
  for (const tz of timezones) {
    if (
      browserTz?.countryCode === tz.countryCode &&
      !defaultSuggestedTzs.find((suggestedTz) => isSameTimezone(suggestedTz?.name, tz.name))
    ) {
      otherPriorityTzs.push(tz)
    }
  }
  return [...defaultSuggestedTzs, ...otherPriorityTzs]
})

// set default value
vModel.value.meta = {
  ...ColumnHelper.getColumnDefaultMeta(UITypes.DateTime),
  ...(vModel.value.meta || {}),
}

const { isSystem } = useColumnCreateStoreOrThrow()
const isDisplayTimezone = computed({
  get: () => !!vModel.value.meta?.isDisplayTimezone,
  set: (value) => {
    if (!vModel.value.meta) vModel.value.meta = {}
    vModel.value.meta.isDisplayTimezone = value
  },
})

const useSameTimezoneForAll = computed({
  get: () => !!vModel.value.meta?.useSameTimezoneForAll,
  set: (value) => {
    if (!vModel.value.meta) vModel.value.meta = {}
    vModel.value.meta.useSameTimezoneForAll = value
    if (!value) vModel.value.meta.timezone = undefined
    else if (!vModel.value.meta.timezone) {
      vModel.value.meta.timezone = priorityTzs.value[0]?.name
    }
  },
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-2 children:flex-1">
      <a-form-item>
        <a-select
          v-model:value="vModel.meta.date_format"
          class="nc-date-select"
          dropdown-class-name="nc-dropdown-date-format"
          :disabled="isSystem"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>

          <a-select-option v-for="(format, i) of dateFormats" :key="i" :value="format">
            <div class="flex gap-2 w-full justify-between items-center">
              {{ format }}
              <component
                :is="iconMap.check"
                v-if="vModel.meta.date_format === format"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
              />
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item>
        <a-select
          v-model:value="vModel.meta.time_format"
          class="nc-time-select"
          dropdown-class-name="nc-dropdown-time-format"
          :disabled="isSystem"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>

          <a-select-option v-for="(format, i) of timeFormats" :key="i" :value="format">
            <div class="flex gap-2 w-full justify-between items-center" :data-testid="`nc-time-${format}`">
              {{ format }}
              <component
                :is="iconMap.check"
                v-if="vModel.meta.time_format === format"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
              />
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
    </div>
    <a-form-item>
      <a-radio-group v-if="vModel.meta" v-model:value="vModel.meta.is12hrFormat" class="nc-time-form-layout" :disabled="isSystem">
        <a-radio :value="true">12 Hrs</a-radio>
        <a-radio :value="false">24 Hrs</a-radio>
      </a-radio-group>
    </a-form-item>

    <template v-if="isEeUI">
      <a-form-item>
        <NcTooltip :disabled="true">
          <div class="flex items-center gap-1">
            <NcSwitch v-model:checked="isDisplayTimezone">
              <div class="text-sm text-gray-800 select-none font-semibold">
                {{ $t('labels.displayTimezone') }}
              </div>
            </NcSwitch>
          </div>
        </NcTooltip>
      </a-form-item>
      <a-form-item>
        <NcTooltip :disabled="true">
          <div class="flex items-center gap-1">
            <NcSwitch v-model:checked="useSameTimezoneForAll">
              <div class="text-sm text-gray-800 select-none font-semibold">
                {{ $t('labels.useSameTimezoneForAllMembers') }}
              </div>
            </NcSwitch>
          </div>
        </NcTooltip>
      </a-form-item>
      <a-form-item v-if="useSameTimezoneForAll">
        <a-select
          v-model:value="vModel.meta.timezone"
          show-search
          allow-clear
          :filter-option="(input, option) => antSelectFilterOption(input, option, ['key', 'data-abbreviation'])"
          dropdown-class-name="nc-dropdown-timezone"
          placeholder="Use same timezone for all collaborator"
          class="nc-search-timezone"
          :disabled="isSystem"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>

          <a-select-opt-group label="Suggested">
            <a-select-option
              v-for="timezone of priorityTzs"
              :key="timezone.name"
              :value="timezone.name"
              :data-abbreviation="timezone.abbreviation"
            >
              <div class="flex gap-2 w-full justify-between items-center">
                <span>{{ timezone.name }}</span>
                <div>
                  <span class="text-nc-content-gray-muted text-[13px] mr-2">
                    {{ timezone.abbreviation }}
                  </span>
                  <component
                    :is="iconMap.check"
                    id="nc-selected-item-icon"
                    class="text-primary w-4 h-4"
                    :class="{ invisible: vModel.meta.timezone !== timezone.name }"
                  />
                </div>
              </div>
            </a-select-option>
          </a-select-opt-group>
          <a-select-opt-group label="All">
            <a-select-option
              v-for="timezone of timezones"
              :key="timezone.name"
              :value="timezone.name"
              :data-abbreviation="timezone.abbreviation"
            >
              <div class="flex gap-2 w-full justify-between items-center">
                <span>{{ timezone.name }}</span>
                <div>
                  <span class="text-nc-content-gray-muted text-[13px] mr-2">
                    {{ timezone.abbreviation }}
                  </span>
                  <component
                    :is="iconMap.check"
                    id="nc-selected-item-icon"
                    class="text-primary w-4 h-4"
                    :class="{ invisible: vModel.meta.timezone !== timezone.name }"
                  />
                </div>
              </div>
            </a-select-option>
          </a-select-opt-group>
        </a-select>
      </a-form-item>
    </template>
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-time-form-layout) {
  @apply flex justify-between gap-2 children:(flex-1 m-0 px-2 py-1 border-1 border-gray-300 rounded-lg);

  .ant-radio-wrapper {
    @apply transition-all;
    &:not(.ant-radio-wrapper-disabled).ant-radio-wrapper-checked {
      @apply border-brand-500;
    }
  }
}
.nc-search-timezone :deep(.ant-select-clear) {
  margin-top: -8px;
}
</style>
