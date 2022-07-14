<template>
  <div class="percent-cell-wrapper">
    <input
      ref="percentInput"
      v-model="localState"
      type="number"
      :step="percentStep"
      @keydown="onKeyDown"
      @blur="onBlur"
      @keydown.enter="isEdited && $emit('input', percent)"
      v-on="parentListeners"
    />
  </div>
</template>

<script>
import { isValidPercent, renderPercent, getPercentStep } from '~/helpers/percentHelper';

export default {
  name: 'PercentCell',
  props: {
    column: Object,
    value: [Number, String],
    readOnly: Boolean,
  },
  data: () => ({
    // flag to determine to show warning message or not
    warningMessage: '',
    // percent in decimal format
    percent: null,
    // check if the cell is edited or not
    isEdited: false,
  }),
  computed: {
    localState: {
      get() {
        return renderPercent(this.value, this.percentType, false);
      },
      set(val) {
        this.isEdited = true;
        if (val === null) {
          val = 0;
        }
        if (isValidPercent(val, this.column?.meta?.negative)) {
          this.percent = val / 100;
        }
      },
    },
    percentType() {
      return this.column?.meta?.precision || 0;
    },
    parentListeners() {
      const $listeners = {};

      if (this.$listeners.blur) {
        $listeners.blur = this.$listeners.blur;
      }
      if (this.$listeners.focus) {
        $listeners.focus = this.$listeners.focus;
      }

      return $listeners;
    },
    percentStep() {
      return getPercentStep(this.percentType);
    },
  },
  mounted() {
    if (this.$refs.percentInput) {
      this.$refs.percentInput.focus();
    }
  },
  methods: {
    onKeyDown(evt) {
      return ['e', 'E', '+', '-'].includes(evt.key) && evt.preventDefault();
    },
    onBlur() {
      if (this.isEdited) {
        this.$emit('input', this.percent);
      }
      this.isEdited = false;
    },
  },
};
</script>

<style scoped>
.nc-grid-cell .percent-cell-wrapper {
  padding: 10px;
}
</style>

<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
-->
