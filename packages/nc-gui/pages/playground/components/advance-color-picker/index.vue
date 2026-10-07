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

const isManagedApp = ref(false)

// `size` only sizes the trigger box; the glyph is sized through icon-class (medium matches BaseNode.vue)
const BASE_ICON_CLASS: Record<(typeof BASE_ICON_SIZES)[number], string> = {
  xsmall: '',
  small: '',
  medium: '!h-6 !w-6',
  large: '!h-8 !w-8',
  xlarge: '!h-12 !w-12',
}

// any managed_app_id swaps the base icon for a managed-app one, so pass none when off
const managedApp = computed(() => (isManagedApp.value ? { managed_app_master: true, managed_app_id: 'prr1pr4xx9vqn5c' } : {}))
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
            <NcSelect v-model:value="baseIconSize">
              <a-select-option v-for="size in BASE_ICON_SIZES" :key="size" :value="size">{{ size }}</a-select-option>
            </NcSelect>
          </div>
          <label class="flex items-center gap-2 h-8 cursor-pointer">
            <NcSwitch v-model:checked="isBaseIconReadonly" size="small" />
            <span class="text-captionSm text-nc-content-gray font-mono">readonly</span>
          </label>
          <NcTooltip title="Passes managedApp with managed_app_master, which shows the managed-app icon" :arrow="false">
            <label class="flex items-center gap-2 h-8 cursor-pointer">
              <NcSwitch v-model:checked="isManagedApp" size="small" />
              <span class="text-captionSm text-nc-content-gray font-mono">Managed App</span>
            </label>
          </NcTooltip>
        </div>
      </PgDemo>

      <PgDemo label="Picker" :hint="`modelValue: ${baseIconColor || 'none'}`">
        <!-- size is read once at setup, so remount to apply a new one -->
        <GeneralBaseIconColorPicker
          :key="baseIconSize"
          :icon-class="BASE_ICON_CLASS[baseIconSize]"
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
