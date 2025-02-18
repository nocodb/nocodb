<script setup lang="ts">
import ColorPropertyPicker from './ColorPropertyPicker.vue'
import GroupedSettings from './GroupedSettings.vue'
import NonNullableNumberInput from './NonNullableNumberInput.vue'

const borderTop = defineModel<string>('borderTop', { required: true })
const borderLeft = defineModel<string>('borderLeft', { required: true })
const borderRight = defineModel<string>('borderRight', { required: true })
const borderBottom = defineModel<string>('borderBottom', { required: true })
const borderColor = defineModel<string>('borderColor', { required: true })
const borderRadius = defineModel<string>('borderRadius', { required: true })

const isBorderLocked = ref(new Set([borderTop.value, borderBottom.value, borderLeft.value, borderRight.value]).size === 1)
const isBorderNone = computed(() => {
  const values = new Set([borderTop.value, borderBottom.value, borderLeft.value, borderRight.value])
  return values.size === 1 && values.values().next().value === '0'
})

function syncIfBorderLocked(val: string) {
  if (!isBorderLocked.value) return
  borderLeft.value = val
  borderRight.value = val
  borderTop.value = val
  borderBottom.value = val
}

watch(borderLeft, syncIfBorderLocked)
watch(borderRight, syncIfBorderLocked)
watch(borderTop, syncIfBorderLocked)
watch(borderBottom, syncIfBorderLocked)

watch(borderColor, (_, oldVal) => {
  if (oldVal === '#000000' && isBorderNone.value) {
    borderLeft.value = '1'
    borderRight.value = '1'
    borderTop.value = '1'
    borderBottom.value = '1'
  }
})
</script>

<template>
  <GroupedSettings title="Border">
    <div class="flex gap-2 items-center">
      <div class="flex flex-col gap-2 border-inputs justify-center items-center flex-1">
        <div>
          <NonNullableNumberInput v-model="borderTop" />
        </div>
        <div class="flex gap-2 items-center">
          <NonNullableNumberInput v-model="borderLeft" />
          <div class="h-10 w-1 rounded-lg bg-nc-bg-gray-light"></div>
          <div class="flex flex-col gap-4 items-center">
            <div class="w-10 h-1 rounded-lg bg-nc-bg-gray-light"></div>
            <NcButton size="xsmall" type="secondary" @click="isBorderLocked = !isBorderLocked" class="shrink-0">
              <GeneralIcon :icon="isBorderLocked ? 'ncLock' : 'ncUnlock'" />
            </NcButton>
            <div class="w-10 h-1 rounded-lg bg-nc-bg-gray-light"></div>
          </div>
          <div class="h-10 w-1 rounded-lg bg-nc-bg-gray-light"></div>
          <NonNullableNumberInput v-model="borderRight" />
        </div>
        <div>
          <NonNullableNumberInput v-model="borderBottom" />
        </div>
      </div>
      <div class="flex-1 flex flex-col gap-2">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <label>Border Color</label>
          <ColorPropertyPicker v-model="borderColor" />
        </div>
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <label>Border Radius</label>
          <NonNullableNumberInput v-model="borderRadius" />
        </div>
      </div>
    </div>
  </GroupedSettings>
</template>
