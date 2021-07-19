<template>
  <v-tooltip v-if="tooltip || $slots['tooltip']" v-bind="tooltipProp">
    <template #activator="{ on }">
      <v-btn :class="[btnClass,$attrs['btn.class']]" v-bind="$attrs" v-on="{...$listeners,...on}">
        <v-icon v-if="icon" small>
          {{ icon }}
        </v-icon>&nbsp;
        <slot />
      </v-btn>
    </template>
    <slot name="tooltip">
      <span>{{ tooltip }}</span>
    </slot>
  </v-tooltip>
  <v-btn v-else ref="btn" v-bind="$attrs" :class="[btnClass,$attrs['btn.class']]" v-on="$listeners">
    <v-icon v-if="icon">
      {{ icon }}
    </v-icon>
    <slot />
  </v-btn>
</template>

<script>
export default {
  name: 'XBtn',
  props: {
    tooltipProp: {
      type: Object,
      default: () => ({
        bottom: true
      })
    },
    btnClass: [Object, String, Array],
    tooltip: String,
    icon: String
  },
  methods: {
  }
}
</script>

<style scoped>

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
