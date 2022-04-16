<template>
  <v-responsive @contextmenu="showMenuFn">
    <!-- <v-layout flex class="project-logs" @contextmenu="showMenuFn">
      <v-flex xs12
      > -->
    <v-data-table
      dense
      :headers="headers"
      :items="logs"
      class="elevation-1 project-logs small-footer"
      flex
      footer-props.items-per-page-options="100"
    >
      <template #item="props">
        <tr class="" style="height:19px !important;">
          <td class="py-0">
            <v-icon
              v-if="props.item.status === 0"
              color="green lighten-1"
              size="10"
            >
              mdi-circle
            </v-icon>
            <v-icon
              v-else-if="props.item.status === 1"
              size="10"
              color="orange lighten-1"
            >
              mdi-circle
            </v-icon>
            <v-icon
              v-else
              size="10"
              color="red lighten-1"
            >
              mdi-circle
            </v-icon>
          </td>
          <td class="caption grey--text py-0">
            {{ props.item.time }}
          </td>
          <td class="caption py-0">
            {{ props.item.action }}
          </td>
        </tr>
      </template>
    </v-data-table>
    <!-- </v-flex
      > -->
    <v-menu
      v-if="showMenu"
      v-model="showMenu"
      absolute
      :position-x="x"
      :position-y="y"
      offset-y
    >
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
    return true
  },
  props: {},
  data() {
    return {
      showMenu: false,
      x: 0,
      y: 0,
      headers: [
        {
          text: '',
          sortable: false,
          width: '1%',
          class: ''
        },
        {
          text: 'Time',
          sortable: false,
          width: '1%',
          class: 'caption'
        },
        {
          text: 'Logs',
          sortable: false,
          width: '100%',
          class: 'caption'
        }
      ],
      logs: [],
      maxLogs: 100
    }
  },
  head() {
    return {}
  },
  computed: {},
  watch: {},
  created() {
  },
  mounted() {
  },
  beforeDestroy() {
  },
  methods: {
    showMenuFn(e) {
      // console.log("showMenuFn", e);
      e.preventDefault()
      this.showMenu = false
      this.x = e.clientX
      this.y = e.clientY
      this.$nextTick(() => {
        this.showMenu = true
      })
    },
    clearLogs() {
      this.logs = []
    }
  },

  beforeCreated() {
  },
  destroy() {
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
