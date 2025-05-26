<script setup lang="ts">
import ClockEditor from './ClockEditor.vue'
import Clock from './Clock.vue'

import TabSwitch from './TabSwitch.vue'
import AddTimezoneAction from './AddTimezoneAction.vue'

import { type AcceptableCity, type AcceptableTimezone, cityToTimezone, timezoneData } from './timezone-data'
import { type ClockInstance, type SavedData, type SelectOption } from './types'
import { calculateTimeDifference, formatTime, getDateForTimezone } from './utils'
import { themes } from './theming'

const { fullscreen, extension } = useExtensionHelperOrThrow()
const { $e } = useNuxtApp()

const EXTENSION_ID = extension.value.extensionId

const clockModeOptions: SelectOption[] = ['Digital', 'Analog', 'Both'].map((value) => ({ value }))
const selectedClockMode = ref<'Digital' | 'Analog' | 'Both'>('Both')

const hFormatOptions: SelectOption[] = ['12H', '24H'].map((value) => ({ value }))
const selectedHFormat = ref<'12H' | '24H'>('24H')

const showNumbers = ref(false)

const clockInstances = shallowRef<ClockInstance[]>([])

const clockTimeStrings = ref<string[]>([])

const activeInstanceId = ref<number | undefined>(clockInstances.value.length ? clockInstances.value[0].id : undefined)
const activeInstance = ref<ClockInstance | undefined>(clockInstances.value.length ? clockInstances.value[0] : undefined)

watch(activeInstanceId, () => {
  activeInstance.value = clockInstances.value.find((ci) => ci.id === activeInstanceId.value)
})

watch(activeInstance, (activeInstance) => {
  if (!activeInstance) return
  clockInstances.value = clockInstances.value.map((ci) => (ci.id === activeInstance.id ? activeInstance : ci))
  saveData()
  $e(`a:extension:${EXTENSION_ID}:update-clock`)
})

const removeInstance = (id: number) => {
  if (!activeInstance) return
  clockInstances.value = clockInstances.value.filter((ci) => ci.id !== id)
  activeInstanceId.value = clockInstances.value.length ? clockInstances.value[clockInstances.value.length - 1].id : undefined
  saveData()
  $e(`a:extension:${EXTENSION_ID}:remove-clock`)
}

const calculateClockTimeStrings = () => {
  clockTimeStrings.value = clockInstances.value.map((ci) =>
    formatTime(getDateForTimezone(cityToTimezone[ci.city]), selectedHFormat.value),
  )
}

let calculateClockStringInterval: number
onMounted(() => {
  calculateClockTimeStrings()
  // need to update every second since there can be difference in time and when user loads clock
  // @ts-expect-error return type of `setInterval` is number in the browser's context
  calculateClockStringInterval = setInterval(calculateClockTimeStrings, 1000)
})

onUnmounted(() => {
  clearInterval(calculateClockStringInterval)
})

const addClock = (city?: AcceptableCity) => {
  if (!city) return -1
  const clockId = Math.round(Math.random() * 1000)
  clockInstances.value.push({
    id: clockId,
    name: city.split(',')[0], // remove country while naming
    theme: 0,
    city,
  })
  calculateClockTimeStrings()
  triggerRef(clockInstances)

  $e(`a:extension:${EXTENSION_ID}:add-clock`)

  return clockId
}

const autoAddClock = () => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone as AcceptableTimezone
  const city = timezoneData.find((td) => td.timezone === timezone)?.city
  return addClock(city)
}

watch(selectedHFormat, calculateClockTimeStrings)

const kvStore = extension.value.kvStore
const savedData = (await kvStore.get('data')) as SavedData | undefined
if (savedData) {
  clockInstances.value = savedData.instances
  activeInstanceId.value = savedData.instances.length ? savedData.instances[0].id : undefined
  showNumbers.value = savedData.config.showNumbers
  selectedHFormat.value = savedData.config.format
  selectedClockMode.value = savedData.config.mode

  if (savedData.instances.length === 0) {
    activeInstanceId.value = autoAddClock()
  }
} else {
  activeInstanceId.value = autoAddClock()
}

async function saveData() {
  const dataToSave: SavedData = {
    config: {
      showNumbers: showNumbers.value,
      format: selectedHFormat.value,
      mode: selectedClockMode.value,
    },
    instances: clockInstances.value,
  }
  await kvStore.set('data', dataToSave)
}

watch([selectedClockMode, selectedHFormat, showNumbers], saveData)

const displayClockInstances = computed(() => clockInstances.value.slice(0, 4))
</script>

<template>
  <ExtensionsExtensionWrapper>
    <div v-if="fullscreen" class="flex w-full h-full">
      <div class="w-80 border-r flex flex-col space-y-4">
        <div class="flex flex-col space-y-4 p-5 pb-1">
          <AddTimezoneAction
            :disable="clockInstances.length >= 4"
            model-value=""
            is-sidebar
            disable-message="Only upto 4 clocks can be created."
            @city-selected="(city) => (activeInstanceId = addClock(city))"
          />
        </div>
        <div class="flex flex-col h-9/12 w-full overflow-y-scroll">
          <div
            v-for="(clockInstance, i) in clockInstances"
            :key="clockInstance.id"
            class="flex w-full justify-between border-t p-3 hover:cursor-pointer text-nc-content-gray-subtle"
            :class="{ 'bg-[#F0F3FF]': activeInstanceId === clockInstance.id, 'border-b': i === clockInstances.length - 1 }"
            @click="activeInstanceId = clockInstance.id"
          >
            <div class="flex flex-col space-y-1 pl-2">
              <span class="text-sm font-bold">{{ clockInstance.name }}</span>
              <span class="text-xs">
                Today, {{ Number(calculateTimeDifference(cityToTimezone[clockInstance.city])) >= 0 ? '+' : '' }}
                {{ calculateTimeDifference(cityToTimezone[clockInstance.city]) }} HRs
              </span>
            </div>
            <div class="flex items-center space-x-2">
              <span class="font-bold text-base">{{ clockTimeStrings[i] }}</span>
              <GeneralIcon v-if="activeInstanceId === clockInstance.id" icon="chevronRight" class="text-brand-600 w-4 h-4" />
              <div v-else class="w-4"></div>
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-4 px-6 py-4 border-t">
          <span class="font-700 text-nc-content-gray-subtle text-[16px]">Settings</span>
          <TabSwitch v-model="selectedClockMode" :options="clockModeOptions" />
          <div class="flex w-full space-x-2">
            <div
              v-if="['Both', 'Analog'].includes(selectedClockMode)"
              class="flex justify-between w-full border-1 rounded-lg p-1 px-2 items-center h-8"
              :class="`${selectedClockMode === 'Both' ? 'w-2/3' : 'w-full'}`"
              style="box-shadow: 0 0 4px 0 rgba(0, 0, 0, 0.08)"
            >
              <span class="text-[14px] font-600">Show numbers</span>
              <NcSwitch v-model:checked="showNumbers" />
            </div>
            <TabSwitch
              v-if="['Both', 'Digital'].includes(selectedClockMode)"
              v-model="selectedHFormat"
              :options="hFormatOptions"
              :class="`${selectedClockMode === 'Both' ? '' : 'w-full'}`"
            />
          </div>
        </div>
      </div>
      <ClockEditor
        v-if="activeInstance"
        v-model="activeInstance"
        class="w-3/4"
        :show-numbers="showNumbers"
        :format="selectedHFormat"
        :clock-mode="selectedClockMode"
        @remove-instance="removeInstance"
      />
    </div>
    <div
      v-else
      class="h-full w-full overflow-x-scroll nc-scrollbar-thin"
      :class="{
        '!min-w-[420px]': selectedClockMode !== 'Digital' && displayClockInstances.length > 1,
        '!min-w-[480px]': selectedClockMode === 'Digital' && displayClockInstances.length > 1,
      }"
    >
      <div class="flex flex-wrap content-start">
        <div
          v-for="(clockInstance, i) in displayClockInstances"
          :key="clockInstance.id"
          class="p-3 flex flex-col justify-center items-center"
          :class="{
            'w-1/2': displayClockInstances.length > 1,
            'w-full': displayClockInstances.length === 1,
            'border-r': displayClockInstances.length > 1 && i % 2 === 0,
            'h-[320px]': selectedClockMode !== 'Digital' && displayClockInstances.length <= 2,
            'h-[176px]': selectedClockMode === 'Digital',
            'h-[208px]': selectedClockMode === 'Analog' && displayClockInstances.length >= 2,
            'h-[252px]': selectedClockMode === 'Both' && displayClockInstances.length >= 2,
            'border-b': displayClockInstances.length >= 2,
          }"
        >
          <div
            class="font-bold text-center text-base w-11/12 truncate !overflow-visible"
            :class="{ 'mb-3': selectedClockMode !== 'Digital' }"
            :style="{ color: themes[clockInstance.theme].textCode }"
          >
            {{ clockInstance.name }}
          </div>
          <Clock
            :show-numbers="showNumbers"
            :format="selectedHFormat"
            :timezone="cityToTimezone[clockInstance.city]"
            :theme="clockInstance.theme"
            :mode="selectedClockMode"
            :edit-mode="false"
          />
        </div>
      </div>
    </div>
  </ExtensionsExtensionWrapper>
</template>
