<script setup lang="ts">
import { useColumnCreateStoreOrThrow } from '#imports'
import { enumColor, getMdiIcon } from '@/utils'

const { formState, validateInfos, setAdditionalValidations, sqlUi, onDataTypeChange, onAlter } = useColumnCreateStoreOrThrow()

// cater existing v1 cases
const iconList = [
  {
    full: 'mdi-star',
    empty: 'mdi-star-outline',
  },
  {
    full: 'mdi-heart',
    empty: 'mdi-heart-outline',
  },
  {
    full: 'mdi-moon-full',
    empty: 'mdi-moon-new',
  },
  {
    full: 'mdi-thumb-up',
    empty: 'mdi-thumb-up-outline',
  },
  {
    full: 'mdi-flag',
    empty: 'mdi-flag-outline',
  },
]

const rowSize = ref(10)

const advanced = ref(true)

const picked = ref(enumColor.light[0])

const colors = ref(['#fcb401', '#faa307', '#f48c06', '#e85d04', '#dc2f02', '#d00000', '#9d0208', '#777'])

function compare(colorA: any, colorB: any) {
  if ((typeof colorA === 'string' || colorA instanceof String) && (typeof colorB === 'string' || colorB instanceof String)) {
    return colorA.toLowerCase() === colorB.toLowerCase()
  }
  return false
}

function select(color: string) {
  picked.value = color
}
</script>

<template>
  <a-row>
    <a-col :span="12">
      <a-form-item label="Icon">
        <a-select v-model:value="formState.meta.icon" size="small" class="w-52">
          <!-- TODO: handle value -->
          <a-select-option v-for="(icon, i) of iconList" :key="i" :value="icon">
            <component
              :is="getMdiIcon(icon.full)"
              :style="{
                color: formState.meta.color,
              }"
            />
            {{ ' ' }}
            <component
              :is="getMdiIcon(icon.empty)"
              :style="{
                color: formState.meta.color,
              }"
            />
          </a-select-option>
        </a-select>
      </a-form-item>
    </a-col>
    <a-col :span="12">
      <a-form-item label="Max">
        <a-select v-model:value="formState.meta.max" class="w-52" size="small">
          <a-select-option v-for="(v, i) in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]" :key="i" :value="v">
            {{ v }}
          </a-select-option>
        </a-select>
      </a-form-item>
    </a-col>
  </a-row>
  <a-row>
    <div class="flex self-center justify-center flex-col pa-[10px]">
      <div v-for="colId in Math.ceil(colors.length / rowSize)" :key="colId" class="flex row">
        <div
          v-for="(color, i) in colors.slice((colId - 1) * rowSize, colId * rowSize)"
          :key="`color-${colId}-${i}`"
          class="color-selector h-[32px] w-[32px] rounded-[5px] my-[10px] mx-[5px] cursor-pointer relative"
          :class="compare(picked, color) ? 'selected' : ''"
          :style="{ 'background-color': color }"
          @click="select(color)"
        >
          {{ compare(picked, color) ? '&#10003;' : '' }}
        </div>
      </div>
      <a-collapse v-model:activeKey="advanced" ghost>
        <a-collapse-panel key="1" header="Advanced">
          <a-button class="lighten-2 w-full" @click="select(picked)"> Pick Color </a-button>
          <v-color-picker v-model="picked" class="align-self-center ma-2" canvas-height="100px" mode="hexa" />
        </a-collapse-panel>
      </a-collapse>
    </div>
  </a-row>
</template>

<style scoped lang="scss">
.color-selector:hover {
  @apply brightness-90;
}

.color-selector.selected {
  @apply py-[5px] px-[10px] brightness-90;
}
</style>
