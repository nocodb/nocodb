<template>
  <v-text-field
    v-model="localState"
    :type="show ? 'text' : 'password'"
    dense
    outlined
    :rules="[v => !!v || !inputDetails.required || 'Required']"
    :name="inputDetails.key"
    :required="inputDetails.valid"
    hide-details="auto"
    :placeholder="inputDetails.placeholder || ''"
    class="caption"
    v-on="parentListeners"
  >
    <template #append>
      <v-icon @click="show = !show">
        {{ show ? 'visibility_off' : 'visibility' }}
      </v-icon>
    </template>
  </v-text-field>
</template>

<script>
export default {
  name: 'PasswordField',
  props: {
    value: String,
    inputDetails: Object,
  },
  data: () => ({
    show: false,
  }),
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

<style scoped>
.wrapper {
  position: relative;
  display: inline-block;
}

.wrapper input {
  padding-right: 20px;
}

.toggle-icon {
  position: absolute;
  right: 4px;
  top: 5px;
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
