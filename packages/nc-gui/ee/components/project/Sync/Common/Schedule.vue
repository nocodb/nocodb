<script lang="ts" setup>
const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits(['change'])

const vModel = useVModel(props, 'modelValue')

const isSyncScheduleOpen = ref(false)

const intervalOptions = ref([
  { value: 'daily', label: 'Daily', description: 'Syncs once a day' },
  { value: 'hourly', label: 'Hourly', description: 'Syncs every hour' },
])

const selectedInterval = ref()

const onChange = (value: string) => {
  // derive cron expression based on selected value
  const date = new Date()
  const minutes = date.getUTCMinutes()
  const hours = date.getUTCHours()
  if (value === 'hourly') {
    vModel.value = `${minutes} * * * *`
  } else if (value === 'daily') {
    vModel.value = `0 ${hours} * * *`
  }

  emit('change', vModel.value)
}

onMounted(() => {
  // initialize selectedInterval based on modelValue (cron expression)
  if (props.modelValue) {
    if (props.modelValue.includes('@hourly') || props.modelValue.match(/^\d+ \* \* \* \*$/)) {
      selectedInterval.value = 'hourly'
    } else if (props.modelValue.match(/^\d+ \d+ \* \* \*$/)) {
      selectedInterval.value = 'daily'
    } else {
      selectedInterval.value = 'daily'
    }
  } else {
    selectedInterval.value = 'daily'
  }
})
</script>

<template>
  <NcListDropdown v-model:is-open="isSyncScheduleOpen" tooltip-wrapper-class="w-full" placement="bottomLeft">
    <div class="flex-1 flex items-center w-full gap-2 justify-between">
      <span class="flex-1 whitespace-nowrap capitalize">{{ selectedInterval || 'Select schedule' }}</span>
      <GeneralIcon
        icon="chevronDown"
        class="flex-none h-4 w-4 transition-transform text-nc-content-gray-subtle"
        :class="{ 'transform rotate-180': isSyncScheduleOpen }"
      />
    </div>
    <template #overlay="{ onEsc }">
      <NcList
        v-model:open="isSyncScheduleOpen"
        v-model:value="selectedInterval"
        :list="intervalOptions"
        option-label-key="value"
        option-value-key="value"
        close-on-select
        :item-height="48"
        class="!w-auto"
        wrapper-class-name="!h-auto"
        @escape="onEsc"
        @update:value="onChange"
      >
        <template #listItem="{ option }">
          <div class="!w-80">
            <div class="w-full flex items-center justify-between">
              <span class="text-captionDropdownDefault">{{ option.label }}</span>
              <GeneralIcon v-if="option.value === selectedInterval" icon="check" class="text-primary h-4 w-4" />
            </div>
            <div class="text-bodySm text-nc-content-gray-muted">{{ option.description }}</div>
          </div>
        </template>
      </NcList>
    </template>
  </NcListDropdown>
</template>
