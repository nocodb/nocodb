<template>
  <v-menu
    v-model="active"
    dense
    :offset-x="offsetX"
    :offset-y="offsetY"
    :position-x="positionX"
    :position-y="positionY"
    :open-on-hover="nested"
  >
    <!--   nested menu activator    -->
    <template v-if="nested" #activator="{ on }">
      <v-list-item dense class="" v-on="on">
        <v-list-item-title class="">
          <slot name="activator">
            {{ parent }}
          </slot>
        </v-list-item-title>
        <v-list-item-action class="my-0 py-0">
          <v-icon>mdi-menu-right</v-icon>
        </v-list-item-action>
      </v-list-item>
    </template>
    <v-list dense>
      <div v-for="(item, index) in items" :key="index" class="">
        <template v-if="item">
          <v-list-item v-if="typeof item !== 'object'" dense @click="$emit('click', { value: item })">
            <v-list-item-title class="">
              {{ index }}
            </v-list-item-title>
          </v-list-item>
          <!--     if value is a nested object then populating nested menu recursively     -->
          <v-list-item v-else dense class="px-0">
            <recursiveMenu offset-x nested :items="item" :parent="index" @click="onSubMenuClick" />
          </v-list-item>
        </template>
        <v-divider v-else />
      </div>
    </v-list>
  </v-menu>
</template>

<script>
export default {
  name: 'RecursiveMenu',
  props: {
    items: Object, // key value pairs where key will be the menu item name and value is passed with click event handler
    value: Boolean, // for getting v-model value
    nested: Boolean, // for populating nested menu(recursively - for internal use)
    offsetY: Boolean,
    offsetX: Boolean,
    parent: String, // for activator slot label
    positionX: Number,
    positionY: Number,
  },
  data() {
    return {
      active: false,
    };
  },
  watch: {
    // two way binding of v-model
    value(v) {
      this.active = v;
    },
    active(v) {
      this.$emit('input', v);
    },
  },
  methods: {
    // event propagating to parent v-menu(click event)
    onSubMenuClick(event) {
      this.$emit('click', event);
      // hiding parent menu
      this.active = false;
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
