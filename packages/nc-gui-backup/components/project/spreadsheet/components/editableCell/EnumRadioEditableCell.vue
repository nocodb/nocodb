<template>
  <div class="d-flex align-center">
    <div>
      <div v-for="(val, i) of enumValues" :key="val" class="item">
        <input :id="`key-radio-${val}`" v-model="localState" type="radio" class="orange--text" :value="val" />
        <label
          class="py-1 px-3 d-inline-block my-1 label"
          :for="`key-radio-${val}`"
          :style="{
            background: colors[i % colors.length],
          }"
          >{{ val }}</label
        >
      </div>
    </div>
  </div>
</template>

<script>
import { enumColor as colors } from '@/components/project/spreadsheet/helpers/colors';

export default {
  name: 'EnumRadioEditableCell',
  props: {
    value: String,
    column: Object,
  },
  computed: {
    colors() {
      return this.$store.state.settings.darkTheme ? colors.dark : colors.light;
    },
    localState: {
      get() {
        return this.value;
      },
      set(val) {
        this.$emit('input', val);
        this.$emit('update');
      },
    },
    enumValues() {
      if (this.column && this.column.dtxp) {
        return this.column.dtxp.split(',').map(v => v.replace(/^'|'$/g, ''));
      }
      return [];
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
    // this.$el.focus();
    // let event;
    // event = document.createEvent('MouseEvents');
    // event.initMouseEvent('mousedown', true, true, window);
    // this.$el.dispatchEvent(event);
  },
};
</script>

<style scoped>
.label {
  border-radius: 25px;
}

.item {
  white-space: nowrap;
}
</style>
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
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
