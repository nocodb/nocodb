<script setup lang="ts">
import { IconType } from 'nocodb-sdk'
import PgSection from '../../-components/PgSection.vue'
import PgDemo from '../../-components/PgDemo.vue'
import type { IconMapKey } from '#imports'

const emoji = ref('🎯')

const pickedIcon = ref<string | null>('ncStar')

const selectorIcon = ref<string | Record<string, any>>('ncRocket')

const selectorIconType = ref<IconType | string>(IconType.ICON)

const color = ref('#cfdffe')

const advanceColor = ref('#3366FF')

const chipColor = ref('')

const baseColor = ref(baseIconColors[1])

const emojiSizes = ['xsmall', 'small', 'medium', 'large', 'xlarge'] as const
</script>

<template>
  <PgSection id="emoji-picker" title="Emoji picker" source="GeneralEmojiPicker">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <PgDemo label="Interactive" :hint="`selected: ${emoji || 'none'}`">
        <!-- the default slot is the trigger while no emoji is set -->
        <div class="flex items-center gap-4">
          <GeneralEmojiPicker :emoji="emoji" size="large" @emoji-selected="emoji = $event">
            <GeneralIcon icon="ncSmile" class="w-5 h-5 text-nc-content-gray-muted" />
          </GeneralEmojiPicker>
        </div>
      </PgDemo>
      <PgDemo label="Readonly sizes">
        <div class="flex items-end gap-4">
          <GeneralEmojiPicker v-for="s in emojiSizes" :key="s" emoji="🚀" :size="s" readonly />
        </div>
      </PgDemo>
    </div>
  </PgSection>

  <PgSection id="icon-picker" title="Icon pickers" source="GeneralIconPicker · GeneralIconSelector">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <PgDemo label="IconPicker" :hint="`value: ${pickedIcon ?? 'none'}`">
        <GeneralIconPicker v-model="pickedIcon">
          <template #default="{ isOpen }">
            <div
              class="w-9 h-9 rounded-lg border-1 flex items-center justify-center cursor-pointer"
              :class="isOpen ? 'border-nc-border-brand shadow-selected' : 'border-nc-border-gray-medium'"
            >
              <GeneralIcon v-if="pickedIcon" :icon="pickedIcon as IconMapKey" class="w-4 h-4" />
              <GeneralIcon v-else icon="ncPlus" class="w-4 h-4 text-nc-content-gray-muted" />
            </div>
          </template>
        </GeneralIconPicker>
      </PgDemo>
      <PgDemo label="IconSelector" :hint="`type: ${selectorIconType || 'none'}`">
        <GeneralIconSelector
          v-model:icon="selectorIcon"
          v-model:icon-type="selectorIconType"
          :hidden-tabs="[IconType.IMAGE]"
          :tab-order="[IconType.ICON, IconType.EMOJI]"
        >
          <template #default="{ isOpen }">
            <div
              class="w-9 h-9 rounded-lg border-1 flex items-center justify-center cursor-pointer text-lg"
              :class="isOpen ? 'border-nc-border-brand shadow-selected' : 'border-nc-border-gray-medium'"
            >
              <GeneralIcon
                v-if="selectorIconType === IconType.ICON && typeof selectorIcon === 'string' && selectorIcon in iconMap"
                :icon="selectorIcon as IconMapKey"
                class="w-4 h-4"
              />
              <span v-else-if="typeof selectorIcon === 'string' && selectorIcon">{{ selectorIcon }}</span>
              <GeneralIcon v-else icon="ncPlus" class="w-4 h-4 text-nc-content-gray-muted" />
            </div>
          </template>
        </GeneralIconSelector>
      </PgDemo>
    </div>
  </PgSection>

  <PgSection
    id="color-pickers"
    title="Colour pickers"
    source="GeneralColorPicker · GeneralAdvanceColorPicker · GeneralBaseIconColorPicker"
  >
    <PgDemo label="ColorPicker" :hint="color">
      <GeneralColorPicker :model-value="color" :row-size="10" :advanced="false" is-new-design @input="color = $event" />
    </PgDemo>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <PgDemo label="AdvanceColorPicker · full" :hint="advanceColor">
        <GeneralAdvanceColorPicker :model-value="advanceColor" @input="advanceColor = $event" />
      </PgDemo>
      <PgDemo label="AdvanceColorPicker · chip palette" :hint="chipColor || 'none'">
        <GeneralAdvanceColorPicker :model-value="chipColor" palette="chip" @input="chipColor = $event" />
      </PgDemo>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <PgDemo label="AdvanceColorPicker dropdown" hint="default · custom trigger · disabled">
        <div class="flex items-center gap-4">
          <GeneralAdvanceColorPickerDropdown v-model="advanceColor" />
          <GeneralAdvanceColorPickerDropdown v-model="advanceColor">
            <NcButton size="small" type="secondary">Custom trigger</NcButton>
          </GeneralAdvanceColorPickerDropdown>
          <NcTooltip title="disabled — the dropdown won't open" :arrow="false">
            <GeneralAdvanceColorPickerDropdown v-model="advanceColor" disabled />
          </NcTooltip>
        </div>
      </PgDemo>
      <PgDemo label="BaseIconColorPicker" :hint="baseColor">
        <div class="flex items-center gap-4">
          <GeneralBaseIconColorPicker v-model="baseColor" size="small" />
          <GeneralBaseIconColorPicker v-model="baseColor" size="medium" />
          <GeneralBaseIconColorPicker v-model="baseColor" size="large" />
          <GeneralBaseIconColorPicker v-model="baseColor" size="large" icon="ncRocket" />
          <GeneralBaseIconColorPicker v-model="baseColor" size="large" readonly />
        </div>
      </PgDemo>
    </div>
  </PgSection>
</template>
