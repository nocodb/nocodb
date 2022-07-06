<template>
  <v-checkbox v-model="localState" color="primary lighten-1" hide-details dense v-on="parentListeners" />
</template>

<script>
export default {
  name: 'CheckBoxField',
  props: {
    value: String,
    inputDetails: Object,
  },
  computed: {
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
  },
};
</script>

<style scoped></style>
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
