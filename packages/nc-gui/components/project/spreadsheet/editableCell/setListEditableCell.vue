<template>
  <div>
    <!--    <select v-on="parentListeners"  v-model="localState" multiple>
          <option v-for="val of setValues" :key="val" :value="val">{{ val }}</option>
        </select>-->

    <v-combobox
      v-model="localState"
      :items="setValues"
      multiple
      chips
      flat
      dense
      hide-details
      deletable-chips
      class="text-center mt-0"
    >
      <template v-slot:selection="data">
        <v-chip
          small
          :key="data"
          :color="colors[setValues.indexOf(data.item) % colors.length]"
          @click:close="data.parent.selectItem(data.item)"
        >
          {{ data.item }}
        </v-chip>
      </template>


      <template v-slot:item="{item}">
        <v-chip small :color="colors[setValues.indexOf(item) % colors.length]">{{ item }}</v-chip>
      </template>
      <template v-slot:append>
        <v-icon small class="mt-2">mdi-menu-down</v-icon>
      </template>
    </v-combobox>
  </div>
</template>

<script>
import colors from "@/mixins/colors";

export default {
  name: "set-list-editable-cell",
  props: {
    value: String,
    column: Object
  },
  mixins: [colors],
  mounted() {
    // this.$el.focus();
    // let event;
    // event = document.createEvent('MouseEvents');
    // event.initMouseEvent('mousedown', true, true, window);
    // this.$el.dispatchEvent(event);
  },
  computed: {
    localState: {
      get() {
        return this.value && this.value.split(',')
      },
      set(val) {
        this.$emit('input', val.filter(v => this.setValues.includes(v)).join(','));
        this.$emit('update');
      }
    },
    setValues() {
      if (this.column && this.column.dtxp) {
        return this.column.dtxp.split(',').map(v => v.replace(/^'|'$/g, ''))
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
  }
}
</script>

<style scoped>
select {
  width: 100%;
  height: 100%;
  color: var(--v-textColor-base);
  -webkit-appearance: menulist;
  /*webkit browsers */
  -moz-appearance: menulist;
  /*Firefox */
  appearance: menulist;
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
