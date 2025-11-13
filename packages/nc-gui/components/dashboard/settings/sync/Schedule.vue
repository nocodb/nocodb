<script lang="ts" setup>
const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits(['change'])

const vModel = useVModel(props, 'modelValue')

const intervalOptions = ref([
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
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
      selectedInterval.value = 'hourly'
    }
  } else {
    selectedInterval.value = 'hourly'
  }
})
</script>

<template>
  <a-select v-model:value="selectedInterval" :options="intervalOptions" @change="onChange">
    <template #suffixIcon>
      <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
    </template>
  </a-select>
</template>
