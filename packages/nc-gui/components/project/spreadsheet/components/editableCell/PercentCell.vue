<template>
  <div class="percent-cell-wrapper">
    <input
      ref="percentInput"
      v-model="localState"
      type="number"
      @blur="onBlur"
      @keypress="checkPercentFormat($event)"
      @keydown.enter="isEdited && $emit('input', percent)"
      v-on="parentListeners"
    />
    <div v-if="warningMessage" class="percent-warning">
      {{ warningMessage }}
    </div>
  </div>
</template>

<script>
import { isValidPercent, renderPercent } from '~/helpers/percentHelper';

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
  },
  mounted() {
    window.addEventListener('keypress', _ => {
      if (this.$refs.percentInput) {
        this.$refs.percentInput.focus();
      }
    });
  },
  methods: {
    checkPercentFormat(evt) {
      evt = evt || window.event;
      const charCode = evt.which ? evt.which : evt.keyCode;
      // ref: http://www.columbia.edu/kermit/ascii.html
      const PRINTABLE_CTL_RANGE = charCode > 31;
      const NON_DIGIT = charCode < 48 || charCode > 57;
      const NON_PERIOD = charCode !== 46;
      const CAPTIAL_LETTER_E = charCode === 69;
      const SMALL_LETTER_E = charCode === 101;
      const NEGATIVE_SIGN = charCode === 45;
      const NEGATIVE_SIGN_INVALID = !this.column?.meta?.negative && NEGATIVE_SIGN;
      if (NEGATIVE_SIGN_INVALID) {
        this.warningMessage = 'Negative Number is not allowed. Please configure it in Column setting.';
        evt.preventDefault();
      } else if (
        (PRINTABLE_CTL_RANGE && NON_DIGIT && NEGATIVE_SIGN_INVALID && NON_PERIOD) ||
        CAPTIAL_LETTER_E ||
        SMALL_LETTER_E
      ) {
        this.warningMessage = 'Please enter a number';
        evt.preventDefault();
      } else {
        this.warningMessage = null;
        // only allow:
        // 1. digits
        // 2. '.'
        // 3. '-' if this.column?.meta?.negative is true
        return true;
      }
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
.percent-cell-wrapper {
  padding: 10px;
}

.percent-warning {
  text-align: left;
  margin-top: 10px;
  color: #e65100;
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
