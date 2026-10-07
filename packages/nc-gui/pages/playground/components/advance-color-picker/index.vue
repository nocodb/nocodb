<script lang="ts" setup>
import PgDemo from '../../-components/PgDemo.vue'
import PgPage from '../../-components/PgPage.vue'
import PgSection from '../../-components/PgSection.vue'

const SECTIONS = [
  { id: 'advance', title: 'Advance colour picker' },
  { id: 'base-icon', title: 'Base icon colour picker' },
]

const BASE_ICON_SIZES = ['xsmall', 'small', 'medium', 'large', 'xlarge'] as const

const color1 = ref('')

const baseIconColor = ref('')

const baseIconSize = ref<(typeof BASE_ICON_SIZES)[number]>('medium')

const isBaseIconReadonly = ref(false)

const managedApp = ref({
  managed_app_master: false,
  managed_app_id: 'prr1pr4xx9vqn5c',
})
</script>

<template>
  <PgPage
    title="Colour pickers"
    description="The palette picker used for field, option and row colours, and the base icon picker in the sidebar."
    :sections="SECTIONS"
  >
    <PgSection
      id="advance"
      title="Advance colour picker"
      source="GeneralAdvanceColorPicker · GeneralAdvanceColorPickerDropdown"
      description="All three demos share one value."
    >
      <PgDemo label="Selected">
        <div class="flex items-center gap-2">
          <div
            class="w-6 h-6 rounded-md border-1 border-nc-border-gray-medium bg-nc-bg-default"
            :style="color1 ? { background: color1 } : undefined"
          />
          <code class="text-captionSm font-mono text-nc-content-gray">{{ color1 || 'none' }}</code>
        </div>
      </PgDemo>

      <PgDemo label="Inline">
        <GeneralAdvanceColorPicker v-model="color1" @input="(c: string) => (color1 = c)" />
      </PgDemo>

      <PgDemo label="Dropdown" hint="default trigger and a custom trigger in the default slot">
        <div class="flex items-center gap-4">
          <GeneralAdvanceColorPickerDropdown v-model="color1" />
          <GeneralAdvanceColorPickerDropdown v-model="color1">
            <NcButton type="secondary" size="small">Pick a colour</NcButton>
          </GeneralAdvanceColorPickerDropdown>
        </div>
      </PgDemo>
    </PgSection>

    <PgSection id="base-icon" title="Base icon colour picker" source="GeneralBaseIconColorPicker">
      <PgDemo label="Props">
        <div class="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div class="flex flex-col gap-1 w-40">
            <span class="text-captionXs text-nc-content-gray-muted font-mono">size</span>
            <NcSelect v-model:value="baseIconSize" size="small">
              <a-select-option v-for="size in BASE_ICON_SIZES" :key="size" :value="size">{{ size }}</a-select-option>
            </NcSelect>
          </div>
          <label class="flex items-center gap-2 h-7 cursor-pointer">
            <NcSwitch v-model:checked="isBaseIconReadonly" size="small" />
            <span class="text-captionSm text-nc-content-gray font-mono">readonly</span>
          </label>
          <label class="flex items-center gap-2 h-7 cursor-pointer">
            <NcSwitch v-model:checked="managedApp.managed_app_master" size="small" />
            <span class="text-captionSm text-nc-content-gray font-mono">managedApp.managed_app_master</span>
          </label>
        </div>
      </PgDemo>

      <PgDemo label="Picker" :hint="`modelValue: ${baseIconColor || 'none'}`">
        <GeneralBaseIconColorPicker
          :model-value="baseIconColor"
          :size="baseIconSize"
          :readonly="isBaseIconReadonly"
          :managed-app="managedApp"
          @update:model-value="baseIconColor = $event"
        />
      </PgDemo>
    </PgSection>
  </PgPage>
</template>
