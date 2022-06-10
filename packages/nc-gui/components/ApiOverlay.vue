<template>
  <v-overlay
    absolute
    color="grey"
    opacity="0.4"
    class="create-project-overlay"
  >
    <div>
      <v-card dark style="width: 100%; max-height:100%;overflow: auto">
        <v-container v-if="databaseCount" fluid style="min-height:200px;">
          <v-card class="pa-2 text-center elevation-10" dark>
            <h3 class="title mb-3 mt-4">
              APIs Generated
            </h3>
            <p>
              <span class="display-3 font-weight-bold">{{ apisCount }}</span><br>
              <span class="subtitle grey--text text--lighten-1">within {{ timeTaken }} seconds</span>
            </p>
          </v-card>
          <v-row>
            <v-col>
              <v-card dark class=" elevation-10">
                <v-card-text class="pb-0 font-weight-bold">
                  # Databases
                </v-card-text>
                <v-card-text class="display-1 white--text">
                  <v-icon class="mt-n2 mr-1" color="info">
                    mdi-database-sync
                  </v-icon>

                  {{ upCount }} / {{ databaseCount }}
                </v-card-text>
              </v-card>
            </v-col>
            <v-col>
              <v-card dark class=" elevation-10">
                <v-card-text class="pb-0 font-weight-bold">
                  # Tables
                </v-card-text>
                <v-card-text class="display-1 white--text">
                  <v-icon class="mr-1 mt-n1 " color="info">
                    mdi-table-large
                  </v-icon>
                  {{ tablesCount }}
                </v-card-text>
              </v-card>
            </v-col>
            <v-col>
              <v-card dark class=" elevation-10">
                <v-card-text class="pb-0 font-weight-bold">
                  Time Saved in Dev Hours
                </v-card-text>
                <v-card-text class="display-1 white--text">
                  <v-icon class="mr-1 mt-n1" color="secondary">
                    mdi-clock-fast
                  </v-icon>
                  {{ hoursSaved }}
                </v-card-text>
              </v-card>
            </v-col>
            <v-col>
              <v-card dark class=" elevation-10">
                <v-card-text class="pb-0 font-weight-bold">
                  Cost Saved
                </v-card-text>
                <v-card-text class="display-1 white--text">
                  <v-icon color="success" class="mt-n2 mr-1">
                    mdi-currency-usd-circle-outline
                  </v-icon>
                  {{ cost }}
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
          <!--                    <v-divider class="my-3 "></v-divider>-->
          <div class="text-center">
            <v-btn v-if="completed" class="my-2 mx-auto" color="primary" x-large to="/xc">
              Goto Dashboard
            </v-btn>
          </div>

          <v-card dark class=" elevation-10">
            <p class="title text-center pt-2">
              List of Databases
            </p>
            <v-simple-table v-if="rowsCount" style="width: 100%">
              <tr v-for="(_,i) in new Array(rowsCount)" :key="i">
                <td v-for="db in databaseList.slice(i * 5 , (i + 1) * 5)" :key="db" class="py-2 px-3">
                  <div class="d-flex">
                    <v-icon :color="db in data ?'green' : 'orange'" x-small class="mr-2">
                      mdi-moon-full
                    </v-icon>
                    <span class="caption">{{ db }}</span>
                    <v-spacer />
                  </div>
                </td>
              </tr>
            </v-simple-table>
          </v-card>
        </v-container>
      </v-card>
    </div>
  </v-overlay>
</template>

<script>
export default {
  name: 'ApiOverlay',
  props: {
    projectCreated: Boolean
  },
  data: () => ({
    client: null,
    data: {},
    databaseList: null,
    upCount: 0,
    tablesCount: 0,
    apisCount: 0,
    timeTaken: 0,
    completed: false,
    perHourCost: 35,
    apisPerHour: 2,
    apis: 0
  }),
  computed: {
    rowsCount() {
      return this.databaseList ? Math.ceil(this.databaseList.length / 5) : 0
    },
    databaseCount() {
      return this.databaseList ? this.databaseList.length : 0
    },
    cost() {
      if (!this.apis) { return 0 }

      const cost = Math.round(this.perHourCost * (this.apis / this.apisPerHour))

      return (cost + '').replace(/\d(?=(?:\d{3})+$)/g, '$&,')
    },
    hoursSaved() {
      if (!this.apis) { return 0 }

      const hours = Math.round(this.apis / this.apisPerHour)

      return (hours + '').replace(/\d(?=(?:\d{3})+$)/g, '$&,')
    }
  },
  created() {
    this.initSocketClient()
  },
  beforeDestroy() {
    if (this.client) {
      this.client.disconnect()
    }
  },
  methods: {
    initSocketClient() {
      try {
        this.client = require('socket.io-client')(`ws://${window.location.hostname}:8083`)
        const self = this
        let toast
        this.client.on('server-to-client', (data) => {
          // console.log('=========== server-to-client ========', data);

          self.$set(self.data, data.data.info.databaseName, data.data.info)

          self.upCount = data.data.startedBuildersCount

          self.tablesCount = (data.data.aggregatedInfo[1] + '').replace(/\d(?=(?:\d{3})+$)/g, '$&,')
          self.apis = data.data.aggregatedInfo[4]
          self.apisCount = (data.data.aggregatedInfo[4] + '').replace(/\d(?=(?:\d{3})+$)/g, '$&,')

          self.timeTaken = data.data.aggregatedInfo[5]

          if ((!self.databaseList || !self.databaseList.length) && data.databaseList) {
            self.databaseList = data.databaseList
          }

          if (!toast) {
            toast = self.$toast.info('', {
              position: 'bottom-center'
            })
          }

          toast.text(`APIs created for ${data.data.info.databaseName}`)

          this.completed = self.databaseList.length === data.data.startedBuildersCount
        })
      } catch (e) { console.log('demo-error') }
    }
  }
}
</script>

<style scoped>

/deep/ .v-overlay__content {
  height: 100%;
  width: 100%;
  padding: 10px;
}

/deep/ .v-overlay__content > div {
  overflow: auto;
  height: 100%;
}

/deep/ .v-overlay__content table tr,
/deep/ .v-overlay__content table td {
  border: 1px solid #7f828b33;
}

/deep/ .v-overlay__content table {
  border-collapse: collapse;
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
