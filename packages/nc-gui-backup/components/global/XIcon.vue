<template>
  <v-tooltip v-if="tooltip" v-bind="tooltipProp">
    <template #activator="{ on }">
      <v-hover v-slot="{ hover }">
        <v-icon
          :class="[hover ? hclass : xclass, iconClass, $attrs['icon.class']]"
          :color="hover ? colors[0] : colors[1]"
          :style="hover ? hstyle : xstyle"
          v-bind="$attrs"
          v-on="{ ...on, ...$listeners }"
        >
          <slot />
        </v-icon>
      </v-hover>
    </template>
    <span v-html="tooltip" />
  </v-tooltip>
  <v-hover v-else v-slot="{ hover }">
    <v-icon
      :class="[hover ? hclass : xclass, iconClass, $attrs['icon.class']]"
      :color="hover ? colors[0] : colors[1]"
      :style="hover ? hstyle : xstyle"
      v-bind="$attrs"
      v-on="$listeners"
    >
      <slot />
    </v-icon>
  </v-hover>
</template>

<script>
export default {
  name: 'XIcon',
  props: {
    tooltipProp: {
      type: Object,
      default: () => ({
        bottom: true,
      }),
    },
    tooltip: String,
    icon: String,
    hclass: String,
    xclass: String,
    hstyle: String,
    xstyle: String,
    hcolor: String,
    color: [String, Array],
    iconClass: String,
  },
  computed: {
    colors() {
      return this.color ? (Array.isArray(this.color) ? this.color : this.color.split(' ')) : [];
    },
  },
  methods: {
    triggerClick(...args) {
      this.$emit('click', ...args);
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
