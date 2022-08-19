<template>
  <v-responsive @contextmenu="showMenuFn">
    <div class="">
      <v-card class="mx-0 pa-0 elevation-0">
        <v-card-text class="pa-0">
          <v-data-table
            class="small-footer"
            dense
            hide-default-header
            :headers="$store.state.outputs.headers"
            :items="$store.state.outputs.list"
            :loading="loading"
          >
            <template #header="{ props: { headers } }">
              <tr style="height: 19px !important">
                <th v-for="header in headers" :key="header.title" class="py-0 caption font-weight-bold">
                  {{ header.text }}
                </th>
              </tr>
            </template>

            <template #item="{ item }">
              <tr style="height: 19px !important">
                <td v-for="(header, index) in $store.state.outputs.headers" :key="index" class="caption my-0 py-0">
                  {{ item[header.text] }}
                </td>
              </tr>
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>
    </div>
    <!-- </v-flex
      > -->
    <v-menu v-if="showMenu" v-model="showMenu" absolute :position-x="x" :position-y="y" offset-y>
      <v-list>
        <v-list-item @click="clearLogs">
          <v-list-item-title>Clear Logs</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
    <!-- </v-layout> -->
  </v-responsive>
</template>

<script>
export default {
  components: {},
  directives: {},
  validate({ params }) {
    return true;
  },
  props: {},
  data() {
    return {
      loading: false,
      showMenu: false,
      x: 0,
      y: 0,
      headers: [],
      result: [],
      maxLogs: 100,
    };
  },
  computed: {},
  watch: {},
  created() {},
  mounted() {},
  beforeDestroy() {},
  methods: {
    showMenuFn(e) {
      e.preventDefault();
      this.showMenu = false;
      this.x = e.clientX;
      this.y = e.clientY;
      this.$nextTick(() => {
        this.showMenu = true;
      });
    },
  },

  beforeCreated() {},
  destroy() {},
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
