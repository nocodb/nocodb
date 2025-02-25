<script setup lang="ts">
import { ColumnHelper, UITypes, dateFormats, timeFormats } from 'nocodb-sdk'
import { getTimeZones } from '@vvo/tzdb'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const timezoneList = computed(() => {
  const timezones = getTimeZones({ includeUtc: true })
  const browserTzName = Intl.DateTimeFormat().resolvedOptions().timeZone
  const browserTz = timezones.find((tz) => tz.name === browserTzName)
  const utcTz = timezones.find((tz) => tz.name === 'Etc/UTC')
  const priorityTz = [utcTz, browserTz].filter((k) => k)
  const restOfTz = []
  for (const tz of timezones) {
    if (['Etc/UTC', browserTzName].includes(tz.name)) {
      continue
    }
    if (browserTz?.countryCode === tz.countryCode) {
      priorityTz.push(tz)
      continue
    }
    restOfTz.push(tz)
  }

  return [...priorityTz, ...restOfTz.sort((a, b) => a.name.localeCompare(b.name))]
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
      <a-form-item :label="$t('title.selectTimezone')">
        <a-select
          v-model:value="vModel.meta.timezone"
          show-search
          allow-clear
          dropdown-class-name="nc-dropdown-date-format"
          placeholder="Use same timezone for all collaborator"
          :disabled="isSystem"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>

          <a-select-option v-for="(timezone, i) of timezoneList" :key="i" :value="timezone.name">
            <div class="flex gap-2 w-full justify-between items-center">
              {{ timezone.name }}
              <div>
                <span class="text-gray-400 mr-2">
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
        </a-select>
      </a-form-item>
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
</style>
