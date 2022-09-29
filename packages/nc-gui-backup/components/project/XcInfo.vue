<template>
  <v-card class="d-100" style="overflow: scroll">
    <v-toolbar height="40" class="elevation-0">
      <v-spacer />

      <x-btn outlined tooltip="Reload Project Info" color="primary" small @click="loadProjectApiInfo">
        <v-icon small left> refresh </v-icon>
        <!-- Reload -->
        {{ $t('general.reload') }}
      </x-btn>
    </v-toolbar>

    <!--        <div class="d-flex justify-center ">
              <v-simple-table dense v-slot:default class="flex-shrink mt-3" v-if="info">
                <thead>
                <tr>
                  <th>Database</th>
                  <th>API Type</th>
                  <th>API Schema
                    <x-icon tooltip="Swagger URL / Proto file / Graphiql" small>mdi-information-outline</x-icon>
                  </th>
                  <th>API Base URL</th>
                </tr>

                </thead>
                <tbody>
                <tr v-for="(db,i) in dbAliasList" :key="i">
                  <td>{{ info[db.meta.dbAlias].database }}</td>
                  <td>

                    <img width="40" v-if="apiTypeIcon[info[db.meta.dbAlias].apiType].type === 'img'"
                         :src="apiTypeIcon[info[db.meta.dbAlias].apiType].src"/>
                    <template v-else>
                      <v-icon :color="apiTypeIcon[info[db.meta.dbAlias].apiType].iconColor">
                        {{ apiTypeIcon[info[db.meta.dbAlias].apiType].icon }}
                      </v-icon>

                      {{ info[db.meta.dbAlias].apiType }}
                    </template>
                  </td>
                  <td>
                    <a v-if="info[db.meta.dbAlias].apiType === 'rest'" :href="info[db.meta.dbAlias].swaggerUrl" target="_blank">{{
                        info[db.meta.dbAlias].swaggerUrl
                      }}</a>
                    <a v-else-if="info[db.meta.dbAlias].apiType === 'graphql'" :href="info[db.meta.dbAlias].gqlApiUrl"
                       target="_blank">{{ info[db.meta.dbAlias].gqlApiUrl }}</a>
                    <a v-else-if="info[db.meta.dbAlias].apiType === 'grpc'" @click.prevent="downloadProto">Download Proto
                      File</a>

                  </td>
                  <td>
                    <span v-if="info[db.meta.dbAlias].apiType === 'rest'">{{ info[db.meta.dbAlias].apiUrl }}</span>
                    <span v-else-if="info[db.meta.dbAlias].apiType === 'graphql'">{{ info[db.meta.dbAlias].gqlApiUrl }}</span>
                    <span v-else-if="info[db.meta.dbAlias].apiType === 'grpc'">{{ info[db.meta.dbAlias].grpcApiUrl }}</span>
                  </td>
                </tr>
                </tbody>
              </v-simple-table>

              <v-skeleton-loader class="mt-2" v-else type="text,table-row-divider@3"></v-skeleton-loader>

            </div>-->

    <v-container v-if="aggregatedInfo" fluid dark>
      <v-card class="pa-2 text-center elevation-10" dark>
        <h3 class="title mb-3 mt-4">Total APIs Generated</h3>
        <p>
          <!--          <span class="display-3 font-weight-bold">{{ apisCount }}</span>-->

          <IOdometer class="iOdometer display-3 font-weight-bold" :value="apisCount" />

          <br />
          <span class="subtitle grey--text text--lighten-1">within {{ timeTaken }} seconds</span>
        </p>
      </v-card>

      <v-row v-for="(item, i) in aggregatedInfo.list" :key="i" class="align-stretch">
        <v-col>
          <v-row>
            <v-col cols="12">
              <v-card dark class="elevation-10 h-100">
                <v-card-text class="pb-0 font-weight-bold"> Database ({{ item.dbType }}) </v-card-text>
                <v-card-text class="display-1 white--text">
                  <v-icon class="mr-1 mt-n1" color="info"> mdi-database </v-icon>
                  {{ item.databaseName }}
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="6">
              <v-card dark class="elevation-10 h-100">
                <v-card-text class="pb-0 font-weight-bold"> # Tables </v-card-text>
                <v-card-text class="display-1 white--text">
                  <v-icon class="mr-1 mt-n1" color="info"> mdi-table-large </v-icon>
                  <!--                  {{ item.tablesCount }}-->
                  <IOdometer class="iOdometer" :value="item.tablesCount" />
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="6">
              <v-card dark class="elevation-10 h-100">
                <v-card-text class="pb-0 font-weight-bold"> # Relations </v-card-text>
                <v-card-text class="display-1 white--text">
                  <v-icon class="mr-1 mt-n1" color="secondary"> mdi-link </v-icon>
                  <!--                  {{ item.relationsCount }}-->
                  <IOdometer class="iOdometer" :value="item.relationsCount" />
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="4">
              <v-card dark class="elevation-10 h-100">
                <v-card-text class="pb-0 font-weight-bold"> # Views </v-card-text>
                <v-card-text class="display-1 white--text">
                  <v-icon color="success" class="mt-n2 mr-1"> mdi-table-border </v-icon>
                  <!--                  {{ item.viewsCount }}-->
                  <IOdometer class="iOdometer" :value="item.viewsCount" />
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="4">
              <v-card dark class="elevation-10 h-100">
                <v-card-text class="pb-0 font-weight-bold"> # Functions </v-card-text>
                <v-card-text class="display-1 white--text">
                  <v-icon color="success" class="mt-n2 mr-1"> mdi-function </v-icon>
                  <!--                  {{ item.functionsCount }}-->
                  <IOdometer class="iOdometer" :value="item.functionsCount" />
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="4">
              <v-card dark class="elevation-10 h-100">
                <v-card-text class="pb-0 font-weight-bold"> # Procedures </v-card-text>
                <v-card-text class="display-1 white--text">
                  <v-icon color="success" class="mt-n2 mr-1"> mdi-code-braces </v-icon>
                  <!--                  {{ item.proceduresCount }}-->
                  <IOdometer class="iOdometer" :value="item.proceduresCount" />
                </v-card-text>
              </v-card>
            </v-col>
            <!--<v-col>
                  <v-card dark class=" elevation-10">
                    <v-card-text class="pb-0 font-weight-bold">Time Saved in Dev Hours</v-card-text>
                    <v-card-text class="display-1 white&#45;&#45;text">
                      <v-icon class="mr-1 mt-n1" color="secondary">mdi-clock-fast</v-icon>
                      {{ hoursSaved }}
                    </v-card-text>
                  </v-card>
                </v-col>
                <v-col>
                  <v-card dark class=" elevation-10">
                    <v-card-text class="pb-0 font-weight-bold">Cost Saved</v-card-text>
                    <v-card-text class="display-1 white&#45;&#45;text">
                      <v-icon color="success" class="mt-n2 mr-1">mdi-currency-usd-circle-outline</v-icon>
                      {{ cost }}
                    </v-card-text>
                  </v-card>
                </v-col>-->
          </v-row>
        </v-col>
        <v-col>
          <v-row class="h-100">
            <v-col cols="12" class="h-100">
              <v-card class="pa-2 elevation-10 h-100" dark>
                <v-card-text v-if="item.type === 'rest'" class="pb-0 font-weight-bold">
                  Swagger API specification
                </v-card-text>
                <v-card-text v-else-if="item.type === 'graphql'" class="pb-0 font-weight-bold">
                  Graphql Endpoint
                </v-card-text>
                <v-card-text class="title white--text">
                  <v-icon color="success" class="mr-1"> mdi-code-json </v-icon>
                  <a :href="`${origin}${item.apiEndpoint}`" target="_blank">{{ `${origin}${item.apiEndpoint}` }}</a>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-col>
      </v-row>
    </v-container>

    <!--    <pre>
          {{ aggregatedInfo }}
        </pre>-->

    <iframe v-if="iframeUrl && showinfoIFrame" style="background: white" width="100%" height="500px" :src="iframeUrl" />
  </v-card>
</template>

<script>
import { mapGetters } from 'vuex';

import IOdometer from 'vue-odometer';
import 'odometer/themes/odometer-theme-default.css';

export default {
  name: 'XcInfo',
  components: {
    IOdometer,
  },
  data: () => ({
    showinfoIFrame: false,
    iframeUrl: null,
    info: null,
    aggregatedInfo: null,
    apiTypeIcon: {
      rest: { icon: 'mdi-code-json', iconColor: 'green' },
      graphql: { icon: 'mdi-graphql', iconColor: 'pink' },
      grpc: { src: 'grpc-icon-color.png', type: 'img' },
    },
    apisCount: 0,
  }),
  computed: {
    ...mapGetters({
      dbAliasList: 'project/GtrDbAliasList',
    }),
    origin() {
      return location.origin;
    },
  },
  async created() {
    await this.loadProjectApiInfo();
    try {
      this.iframeUrl = `${this.$axios.defaults.baseURL}/dashboard/status`;
      await this.$axios.get(this.iframeUrl);
      this.showinfoIFrame = true;
    } catch (e) {
      this.showinfoIFrame = false;
    }
  },
  mounted() {},
  methods: {
    async loadProjectApiInfo() {
      try {
        const { info, aggregatedInfo } = (
          await this.$axios.get(`/nc/${this.$route.params.project_id}/projectApiInfo`, {
            headers: {
              'xc-auth': this.$store.state.users.token,
            },
          })
        ).data;
        this.info = info;
        const { aggregated, list } = aggregatedInfo;

        this.aggregatedInfo = {
          aggregated,
          list: list.map(it => {
            return {
              ...it,
              functionsCount: 0,
              proceduresCount: 0,
              relationsCount: 0,
              tablesCount: 0,
              viewsCount: 0,
            };
          }),
        };
        const apisCount = aggregatedInfo.aggregated[4]; // +((
        // aggregatedInfo.aggregated[4]
        // + '').replace(/\d(?=(?:\d{3})+$)/g, '$&,')) || 0;
        this.apisCount = 0;

        this.$nextTick(() => {
          this.apisCount = apisCount;
          this.$set(this.aggregatedInfo, 'list', list);
        });

        this.timeTaken = aggregatedInfo.aggregated[5];
      } catch (e) {
        // this.$toast.error('Some error occurred').goAway(3000);
      }
    },
    async downloadProto() {
      this.loading = true;
      let data;
      try {
        data = await this.$store.dispatch('sqlMgr/ActSqlOp', [
          null,
          'grpcProtoDownloadZip',
          {},
          null,
          {
            responseType: 'blob',
          },
        ]);
        const url = window.URL.createObjectURL(new Blob([data], { type: 'application/zip' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'proto.zip'); // or any other extension
        document.body.appendChild(link);
        link.click();
        // this.$toast.success('Successfully exported metadata').goAway(3000)
        this.$toast.success(`${this.$t('msg.toast.exportMetadata')}`).goAway(3000);
      } catch (e) {
        this.$toast.error('Some internal error occurred').goAway(3000);
      }
      this.loading = false;
    },
  },
};
</script>

<style scoped>
iframe {
  border: none;
}
</style>
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
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
