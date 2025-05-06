<script lang="ts" setup>
import { ROW_COLORING_MODE } from 'nocodb-sdk'

interface Props {
  rowColoringMode?: ROW_COLORING_MODE
}

interface Emits {
  (event: 'update:rowColoringMode', model: ROW_COLORING_MODE): void
  (event: 'change', model: ROW_COLORING_MODE): void
}

const props = defineProps<Props>()
const emits = defineEmits<Emits>()
const rowColoringModeVModel = useVModel(props, 'rowColoringMode', emits)

const buttonClass = 'flex-grow !inline-flex !border-none !shadow-none !rounded-[0px] !text-left content-top !py-2 !px-4'
const chooseOption = (option: ROW_COLORING_MODE) => {
  rowColoringModeVModel.value = option
  emits('change', option)
}
</script>

<template>
  <template v-if="!rowColoringMode">
    <div
      class="bg-white w-[320px] h-[132px] flex flex-col rounded-[8px] overflow-hidden py-2 animate-animated animate-fadeIn"
      style="animation-duration: 0.3s"
    >
      <a-button :class="[buttonClass]" type="text" @click.stop="chooseOption(ROW_COLORING_MODE.SELECT)">
        <div class="flex flex-col gap-1">
          <div class="flex gap-2 items-center">
            <GeneralIcon class="w-[16px] h-[16px]" icon="singleSelect" />
            <span>Using Single select field</span>
          </div>
          <div>
            <span class="text-nc-content-gray-muted ml-[24px]" style="font-size: 13px"
              >Colour records based on single select field</span
            >
          </div>
        </div>
      </a-button>
      <a-button :class="[buttonClass]" type="text" @click.stop="chooseOption(ROW_COLORING_MODE.FILTER)">
        <div class="flex flex-col gap-1">
          <div class="flex gap-2 items-center">
            <GeneralIcon class="w-[16px] h-[16px]" icon="ncConditions" />
            <span>Using Conditions</span>
          </div>
          <div>
            <span class="text-nc-content-gray-muted ml-[24px]" style="font-size: 13px">Colour records based on conditions</span>
          </div>
        </div>
      </a-button>
    </div>
  </template>
  <template v-else-if="rowColoringMode === ROW_COLORING_MODE.FILTER">
    <slot name="filter"></slot>
  </template>
  <template v-else-if="rowColoringMode === ROW_COLORING_MODE.SELECT">
    <slot name="select"></slot>
  </template>
</template>
