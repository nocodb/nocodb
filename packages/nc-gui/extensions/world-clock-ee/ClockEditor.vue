<script setup lang="ts">
import Clock from './Clock.vue'
import { type AcceptableCity, cityToTimezone } from './timezone-data'
import { themes } from './theming'
import type { ClockInstance } from './types'
import AddTimezoneAction from './AddTimezoneAction.vue'

const props = defineProps<{
  showNumbers: boolean
  modelValue: ClockInstance
  format: '12H' | '24H'
  clockMode: 'Digital' | 'Analog' | 'Both'
}>()

const emits = defineEmits<{
  'update:modelValue': [ClockInstance]
  'removeInstance': [number]
}>()

const clockInstance = useVModel(props, 'modelValue', emits)

const name = ref(clockInstance.value.name)
const city = ref<AcceptableCity>(clockInstance.value.city)
const themeId = ref<number>(clockInstance.value.theme)

watch(name, () => {
  name.value = name.value.slice(0, 25)
})

watch(clockInstance, () => {
  name.value = clockInstance.value.name
  city.value = clockInstance.value.city
  themeId.value = clockInstance.value.theme
})

watchDebounced(
  [name, city, themeId],
  ([name, city, themeId]) => {
    let nameToSave = name
    // city changed
    if (clockInstance.value.city !== city) {
      if (clockInstance.value.name === clockInstance.value.city.split(',')[0]) {
        nameToSave = city.split(',')[0]
      }
    }
    clockInstance.value = {
      ...clockInstance.value,
      name: nameToSave,
      city,
      theme: themeId,
    }
  },
  { debounce: 100, maxWait: 1000 },
)
</script>

<template>
  <div class="flex w-full h-full justify-center items-start py-8 overflow-y-scroll">
    <div class="flex flex-col w-1/2 space-y-4 pb-4">
      <div class="w-full flex items-center relative overflow-hidden">
        <input
          v-model="name"
          type="text"
          class="flex-1 w-[calc(100%_-_24px)] bg-nc-bg-gray-light font-bold rounded-xl h-12 text-xl border-transparent focus:border-transparent focus:ring-0 outline-none truncate !pr-10"
        />
        <div class="flex items-center justify-end h-12 rounded-r-xl pr-3 absolute right-0 pointer-events-none">
          <GeneralIcon class="w-6 h-6 text-nc-content-gray-muted" icon="edit" />
        </div>
      </div>

      <AddTimezoneAction v-model:model-value="city" />

      <div class="flex flex-col space-y-1 pt-3">
        <span class="text-sm text-zinc-700">Theme</span>
        <div class="flex gap-4 w-full flex-wrap">
          <button
            v-for="(theme, i) in themes"
            :key="i"
            class="w-7 h-7 rounded flex items-center justify-center border-nc-border-brand flex-none"
            :class="{ 'border-1': themeId === i, 'shadow': themeId === i, 'shadow-brand-200': themeId === i }"
            :style="{ background: theme.icon }"
            @click="themeId = i"
          />
        </div>
      </div>
      <div class="flex w-full items-start justify-center">
        <Clock
          :class="`${clockMode === 'Digital' ? 'w-full' : 'w-1/2'}`"
          :show-numbers="showNumbers"
          :format="format"
          :timezone="cityToTimezone[city]"
          :theme="themeId"
          :mode="clockMode"
          :edit-mode="true"
        />
      </div>
      <NcButton type="secondary" size="small" @click="emits('removeInstance', clockInstance.id)">
        <span class="text-red-600">Remove City</span>
      </NcButton>
    </div>
  </div>
</template>
