<template>
  <div>
    <v-select
      v-model="localState"
      :items="setValues"
      :menu-props="{ bottom: true, offsetY: true }"
      item-value="title"
      multiple
      chips
      flat
      dense
      solo
      hide-details
      deletable-chips
      :class="`text-center mt-0 ${isForm ? 'form-select': ''}`"
    >
      <template #selection="data">
        <v-chip
          :color="data.item.color"
          small
          close
          close-icon="mdi-close"
          class="ma-1"
          @click:close="data.parent.selectItem(data.item)"
        >
          {{ data.item.title }}
        </v-chip>
      </template>

      <template #item="{item}">
        <v-chip small :color="item.color">
          {{ item.title }}
        </v-chip>
      </template>
      <template #append>
        <v-icon small class="mt-1">
          mdi-menu-down
        </v-icon>
      </template>
    </v-select>
  </div>
</template>

<script>
export default {
  name: 'SetListEditableCell',
  props: {
    value: String,
    column: Object,
    isForm: Boolean,
  },
  computed: {
    localState: {
      get() {
        return typeof this.value === 'string' ? this.value.split(',') : [];
      },
      set(val) {
        this.$emit('input', val.filter(v => this.setValues.find(el => el.title === v)).join(','));
      },
    },
    setValues() {
      const opts = this.column.colOptions.options || [];
      for (const op of opts.filter(el => el.order === null)) {
        op.title = op.title.replace(/^'/, '').replace(/'$/, '');
      }
      return opts;
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

<style scoped lang="scss">

::v-deep {
  .v-select {
    min-width: 150px;
    .v-select__selections {
      min-height: 38px !important;
    }
  }
  .v-input__slot{
    padding-right: 0 !important;
  }
  .v-input__icon.v-input__icon--clear {
    width: 15px !important;
    .v-icon {
      font-size: 13px !important;
    }
  }
  .mdi-close {
    font-size: 12px !important;
    color: gray !important;
  }
  .form-select {
    .v-select__selections {
      border: 1px solid rgba(127,130,139,0.2);
    }
    input {
      z-index: -1;
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
