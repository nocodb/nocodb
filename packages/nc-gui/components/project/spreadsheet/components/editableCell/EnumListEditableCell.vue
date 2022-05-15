<template>
  <v-select
    v-model="localState"
    solo
    dense
    flat
    :items="enumValues"
    hide-details
    class="mt-0"
    :clearable="!column.rqd"
    v-on="parentListeners"
  >
    <template #selection="{item}">
      <div
        class="d-100"
        :class="{
          'text-center' : !isForm
        }"
      >
        <v-chip small :color="colors[enumValues.indexOf(item) % colors.length]" class="ma-1">
          {{ item }}
        </v-chip>
      </div>
    </template>
    <template #item="{item}">
      <v-chip small :color="colors[enumValues.indexOf(item) % colors.length]">
        {{ item }}
      </v-chip>
    </template>
    <template #append>
      <v-icon small class="mt-1">
        mdi-menu-down
      </v-icon>
    </template>
  </v-select>
</template>

<script>
import colors from '@/mixins/colors'

export default {
  name: 'EnumListEditableCell',
  mixins: [colors],

  props: {
    value: String,
    column: Object,
    isForm: Boolean
  },
  computed: {
    localState: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
        this.$emit('update')
      }
    },
    enumValues() {
      if (this.column && this.column.dtxp) {
        return this.column.dtxp.split(',').map(v => v.replace(/\\'/g, '\'').replace(/^'|'$/g, ''))
      }
      return []
    },
    parentListeners() {
      const $listeners = {}

      if (this.$listeners.blur) {
        $listeners.blur = this.$listeners.blur
      }
      if (this.$listeners.focus) {
        $listeners.focus = this.$listeners.focus
      }

      return $listeners
    }
  },
  mounted() {
    // this.$el.focus();
    // let event;
    // event = document.createEvent('MouseEvents');
    // event.initMouseEvent('mousedown', true, true, window);
    // this.$el.dispatchEvent(event);
  }
}
</script>

<style scoped lang="scss">
::v-deep {
  .v-select {
    min-width: 150px;
  }
  .v-input__slot{
    padding-right: 0 !important;
    padding-left: 35px !important;
  }
  .v-input__icon.v-input__icon--clear {
    width: 15px !important;
    min-width: 13px !important;

    .v-icon {
      font-size: 13px !important;
    }
  }
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
