<template>
  <div class="d-flex align-center">


    <v-icon v-if="column.hm" color="warning" x-small class="mr-1">mdi-table-arrow-right</v-icon>
    <v-icon v-else-if="column.bt" color="info" x-small class="mr-1">mdi-table-arrow-left</v-icon>
    <v-icon v-else-if="column.mm" color="pink" x-small class="mr-1">mdi-table-network</v-icon>

    {{ column._cn }}

    <span v-if="column.rqd" class="error--text text--lighten-1">&nbsp;*</span>

    <v-spacer>
    </v-spacer>

    <v-menu offset-y open-on-hover left>
      <template v-slot:activator="{on}">
        <v-icon v-on="on" small>mdi-menu-down</v-icon>
      </template>
      <v-list dense>
        <v-list-item dense @click="editColumnMenu = true">
          <x-icon small class="mr-1" color="primary">mdi-pencil</x-icon>
          <span class="caption">Edit</span>
        </v-list-item>
        <v-list-item dense @click="setAsPrimaryValue">
          <x-icon small class="mr-1" color="primary">mdi-key-star</x-icon>
          <v-tooltip bottom>
            <template v-slot:activator="{on}">
              <span class="caption" v-on="on">Set as Primary value</span>
            </template>
            <span class="caption font-weight-bold">Primary value will be shown in place of primary key</span>
          </v-tooltip>
        </v-list-item>
        <v-list-item @click="columnDeleteDialog = true">
          <x-icon small class="mr-1" color="error">mdi-delete-outline</x-icon>
          <span class="caption">Delete</span>
        </v-list-item>
      </v-list>
    </v-menu>




  </div>
</template>
<script>
export default {
  props: ['column'],
  name: "virtualHeaderCell",
  data: () => ({
  }),
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
