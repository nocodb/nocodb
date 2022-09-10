<template>
  <div class="d-flex align-center" :class="{ 'justify-center': !isForm, 'nc-cell-hover-show': !localState }">
    <v-icon small :color="checkboxMeta.color" @click="toggle">
      {{ localState ? checkedIcon : uncheckedIcon }}
    </v-icon>
  </div>
</template>

<script>
export default {
  name: 'BooleanCell',
  props: {
    column: Object,
    value: [String, Number, Boolean],
    isForm: Boolean,
    readOnly: Boolean,
  },
  computed: {
    checkedIcon() {
      return (this.checkboxMeta && this.checkboxMeta.icon && this.checkboxMeta.icon.checked) || 'mdi-check-bold';
    },
    uncheckedIcon() {
      return (this.checkboxMeta && this.checkboxMeta.icon && this.checkboxMeta.icon.unchecked) || 'mdi-crop-square';
    },
    localState: {
      get() {
        return this.value;
      },
      set(val) {
        this.$emit('input', val);
      },
    },
    parentListeners() {
      const $listeners = {};
      return $listeners;
    },
    checkboxMeta() {
      return {
        icon: {
          checked: 'mdi-check-circle-outline',
          unchecked: 'mdi-checkbox-blank-circle-outline',
        },
        color: 'primary',
        ...(this.column && this.column.meta ? this.column.meta : {}),
      };
    },
  },
  methods: {
    toggle() {
      this.localState = !this.localState;
    },
  },
};
</script>

<style scoped></style>
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
