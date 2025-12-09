<script setup lang="ts">
import { type TimeZone, getTimeZones } from '@vvo/tzdb'

const isSameTimezone = (tz1: string, tz2: string): boolean => {
  if (!tz1 || !tz2) return false
  if (tz1 === tz2) return true

  try {
    const formatter1 = new Intl.DateTimeFormat('en', { timeZone: tz1 })
    const formatter2 = new Intl.DateTimeFormat('en', { timeZone: tz2 })

    const date = new Date('2024-01-01T00:00:00')
    const offset1 = formatter1.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value
    const offset2 = formatter2.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value

    return offset1 === offset2
  } catch {
    return false
  }
}

interface CronTriggerNodeConfig {
  cronExpression?: string
  timezone?: string
}

const { selectedNodeId, updateNode, selectedNode } = useWorkflowOrThrow()

const { t } = useI18n()

const config = computed<CronTriggerNodeConfig>(() => {
  return (selectedNode.value?.data?.config || {}) as CronTriggerNodeConfig
})

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

const updateConfig = (updates: Partial<CronTriggerNodeConfig>) => {
  if (!selectedNodeId.value) return
  updateNode(selectedNodeId.value, {
    data: {
      ...selectedNode.value?.data,
      config: {
        ...config.value,
        ...updates,
      },
    },
  })
}

const onCronExpressionChange = (value: string) => {
  updateConfig({ cronExpression: value })
}

const onTimezoneChange = (value: string) => {
  updateConfig({ timezone: value || undefined })
}
</script>

<template>
  <a-form layout="vertical">
    <a-form-item label="Cron Expression">
      <a-input
        class="nc-input-shadow !rounded-lg"
        :value="config.cronExpression"
        placeholder="*/5 * * * *"
        @input="onCronExpressionChange($event.target.value)"
      />
    </a-form-item>

    <a-form-item label="Timezone">
      <a-select
        :value="config.timezone"
        show-search
        allow-clear
        :filter-option="(input, option) => antSelectFilterOption(input, option, ['key', 'data-abbreviation'])"
        dropdown-class-name="nc-dropdown-timezone"
        :placeholder="t('workflow.selectTimezone')"
        class="nc-search-timezone"
        @change="onTimezoneChange"
      >
        <template #suffixIcon>
          <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
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
                  :class="{ invisible: config.timezone !== timezone.name }"
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
                  :class="{ invisible: config.timezone !== timezone.name }"
                />
              </div>
            </div>
          </a-select-option>
        </a-select-opt-group>
      </a-select>
    </a-form-item>
  </a-form>
</template>

<style scoped lang="scss">
:deep(.nc-dropdown-timezone) {
  .ant-select-item-option-content {
    @apply flex items-center justify-between w-full;
  }
}
</style>
