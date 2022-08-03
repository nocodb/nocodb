<script setup lang="ts">
import { useColumnCreateStoreOrThrow } from '#imports'
import { getMdiIcon, enumColor } from '@/utils'

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

const colors = ref(['#fcb401', '#faa307', '#f48c06', '#e85d04', '#dc2f02', '#d00000', '#9d0208', '#777'])

function compare(colorA: any, colorB: any) {
  if ((typeof colorA === 'string' || colorA instanceof String) && (typeof colorB === 'string' || colorB instanceof String)) {
    return colorA.toLowerCase() === colorB.toLowerCase()
  }
  return false
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
  <!-- TODO: add color picker -->
  <a-row>
    <div class="color-picker">
      <div v-for="colId in Math.ceil(colors.length / rowSize)" :key="colId" class="color-picker-row">
        <button
          v-for="(color, i) in colors.slice((colId - 1) * rowSize, colId * rowSize)"
          :key="`color-${colId}-${i}`"
          class="color-selector"
          :class="compare(picked, color) ? 'selected' : ''"
          :style="{ 'background-color': color }"
          @click="select(color)"
        >
          {{ compare(picked, color) ? '&#10003;' : '' }}
        </button>
      </div>
      <v-expansion-panels v-if="advanced">
        <v-expansion-panel>
          <v-expansion-panel-header>Advanced</v-expansion-panel-header>
          <v-expansion-panel-content>
            <v-container class="d-flex flex-column">
              <v-btn class="primary lighten-2" @click="select(picked)"> Pick Color </v-btn>
              <v-color-picker v-model="picked" class="align-self-center ma-2" canvas-height="100px" mode="hexa" />
            </v-container>
          </v-expansion-panel-content>
        </v-expansion-panel>
      </v-expansion-panels>
    </div>
  </a-row>
</template>