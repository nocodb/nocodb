<template>
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
</template>

<script>
import { enumColor } from '@/components/project/spreadsheet/helpers/colors';

export default {
  name: 'ColorPicker',
  props: {
    value: {
      type: String,
      default: () => enumColor.light[0],
    },
    colors: {
      type: Array,
      default: () => enumColor.light.concat(enumColor.dark),
    },
    rowSize: {
      type: Number,
      default: () => 10,
    },
    advanced: {
      type: Boolean,
      default: () => true,
    },
  },
  data: () => ({
    picked: '',
  }),
  created() {
    this.picked = this.value || '';
  },
  methods: {
    select(color) {
      this.picked = color;
      this.$emit('input', color);
    },
    compare(colorA, colorB) {
      if (
        (typeof colorA === 'string' || colorA instanceof String) &&
        (typeof colorB === 'string' || colorB instanceof String)
      ) {
        return colorA.toLowerCase() === colorB.toLowerCase();
      }
      return false;
    },
  },
};
</script>

<style scoped>
.color-picker {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background: white;
  padding: 10px;
}

.color-picker-row {
  display: flex;
  flex-direction: row;
}

.color-selector {
  position: relative;
  height: 32px;
  width: 32px;
  margin: 10px 5px;
  border-radius: 5px;
  -webkit-text-stroke-width: 1px;
  -webkit-text-stroke-color: white;
}

.color-selector:hover {
  filter: brightness(90%);
  -webkit-filter: brightness(90%);
}

.color-selector.selected {
  filter: brightness(90%);
  -webkit-filter: brightness(90%);
}

/deep/ .v-input__control {
  height: auto !important;
}
</style>
