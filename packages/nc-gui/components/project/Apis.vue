<template>
  <v-container class="ma-0 pa-0" fluid>
    <v-card class="text-center">
      <v-col cols="10" offset="1" class="pa-10">
        <div style="border: 1px solid grey">
          <v-toolbar height="42" flat class="toolbar-border-bottom">
            <v-breadcrumbs
              :items="[{
                text: nodes.env,
                disabled: true,
                href: '#'
              },{
                text: nodes.dbAlias,
                disabled: true,
                href: '#'
              }]"
              divider=">"
              small
            >
              <template #divider>
                <v-icon small color="grey lighten-2">
                  forward
                </v-icon>
              </template>
            </v-breadcrumbs>

            <v-spacer />

            <v-btn small outlined color="success" :disabled="!!server1" @click="startServer">
              <v-icon>mdi-play</v-icon>
              &nbsp;Start API Server
            </v-btn>
            <v-btn small outlined color="error" :disabled="!server1" @click="stopServer">
              <v-icon>mdi-stop</v-icon>
              &nbsp;Stop API Server
            </v-btn>
          </v-toolbar>
          <v-card class="elevation-1 pa-8 text-left">
            <v-col cols="4" offset="4">
              <v-text-field
                v-model="portNumber"
                :height="20"
                label="Port for webserver"
                autofocus
              />
            </v-col>

            <v-card v-if="server1" class="elevation-1 pa-4">
              <p class="text-center display-1 pt-2">
                Generating APIs at the speed of your thought
              </p>
              <!--            <v-divider></v-divider>-->
              <br>

              <v-simple-table class="text-center">
                <template #default>
                  <tbody>
                    <tr>
                      <td>Total Tables in Database</td>
                      <td class="text-left">
                        {{ server1.tables }}
                      </td>
                    </tr>
                    <tr>
                      <td>APIs generated</td>
                      <td class="text-left">
                        {{ server1.apis }}
                      </td>
                    </tr>
                    <tr>
                      <td>Local URL</td>
                      <td class="text-left">
                        <a
                          class="title"
                          @click.prevent="openUrl(server1.localUrl)"
                        >
                          {{ server1.localUrl }}</a>
                        <v-btn
                          v-clipboard="`${server1.localUrl}/pwa`"
                          v-clipboard:success="clipboardSuccessHandler"
                          v-clipboard:error="clipboardErrorHandler"
                          small
                          text
                        >
                          <v-icon>mdi-content-copy</v-icon>
                        </v-btn>
                      </td>
                    </tr>
                    <tr>
                      <td>Cloud URL</td>
                      <td class="text-left">
                        <v-btn v-if="!server1.cloudUrl" outlined color="primary" @click.prevent="getCloudUrl()">
                          <v-icon>mdi-cloud-outline</v-icon>
                          &nbsp;Get Cloud URL
                        </v-btn>
                        <span v-else style="" class="title">
                          <a @click.prevent="openUrl(server1.cloudUrl)">
                            {{ server1.cloudUrl }}</a>

                          <v-btn
                            v-clipboard="server1.cloudUrl"
                            v-clipboard:success="clipboardSuccessHandler"
                            v-clipboard:error="clipboardErrorHandler"
                            small
                            text
                          ><v-icon>mdi-content-copy</v-icon></v-btn>
                        </span>
                      </td>
                    </tr>

                    <tr v-if="server1.cloudUrl">
                      <td>Web App Url</td>
                      <td class="text-left">
                        <br>
                        <a class="title" @click.prevent="openWebUrl(server1.cloudUrl+'/pwa')">
                          {{ server1.cloudUrl }}/pwa
                        </a>
                        <v-btn
                          v-clipboard="`${server1.cloudUrl}/pwa`"
                          v-clipboard:success="clipboardSuccessHandler"
                          v-clipboard:error="clipboardErrorHandler"
                          small
                          text
                        >
                          <v-icon>mdi-content-copy</v-icon>
                        </v-btn>
                        <br>
                        <br>

                        <v-btn outlined color="primary" class="mb-4 " @click.prevent="sendNotification()">
                          <v-icon>mdi-send</v-icon> &nbsp;
                          Send Push Notification
                        </v-btn>
                      </td>
                    </tr>
                  </tbody>
                </template>
              </v-simple-table>

              <!--            <p class="title">Total Tables : {{server1.tables}}</p>-->
              <!--            <p class="title">APIs generated: {{server1.apis}}</p>-->
              <!--            <p class="title">Local URL : <span style="color: lightskyblue;"><a-->
              <!--              @click.prevent="openUrl(server1.localUrl)">-->
              <!--                          {{server1.localUrl}}</a></span>-->
              <!--            </p>-->

              <!--            <p class="title" v-if="!server1.cloudUrl">Cloud URL :-->
              <!--              <v-btn @click.prevent="getCloudUrl()" class="primary">Get Cloud URL</v-btn>-->
              <!--            </p>-->
              <!--            <p v-else class="title">-->
              <!--                          <span style="">Cloud URL :-->
              <!--                            <a @click.prevent="openUrl(server1.cloudUrl)">-->
              <!--                          {{server1.cloudUrl}}</a>-->
              <!--                          </span>-->
              <!--            </p>-->
            </v-card>
          </v-card>
        </div>
      </v-col>
    </v-card>
  </v-container>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'

export default {
  components: {},
  data() {
    return {

      // portNumber: 3000,

    }
  },
  computed: {
    ...mapGetters({
      sqlMgr: 'sqlMgr/sqlMgr',
      tabs: 'tabs/list'
    }),

    server1() {
      return this.$store.state.apiServer.servers[this.nodes.key]
    },

    portNumber() {
      return this.server1 ? this.server1.portNumber : 3000
    }

  },
  methods: {

    ...mapActions({
      changeActiveTab: 'tabs/changeActiveTab'
    }),

    openWebUrl(url) {
      // shell.openExternal(url)
    },

    openUrl(url) {
      const _nodes = { ...this.nodes }
      _nodes.key = _nodes.dbKey + '.apiClient'
      _nodes.type = 'apiClientDir'
      _nodes.url = url
      const tabIndex = this.tabs.findIndex(el => el.key === _nodes.key)
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex)
      } else {
        this.$store.dispatch('tabs/ActAddTab', {
          name: 'API Client',
          key: _nodes.key,
          _nodes
        })
      }
    },

    async startServer() {
      try {
        const args = { ...this.nodes }
        args.portNumber = this.server1 ? this.server1.portNumber : 3000

        await this.$store.dispatch('apiServer/start', args)

        this.$toast.success('API server started successfully', { duration: 1000 })
      } catch (e) {
        console.log(e)
        throw e
      }
    },

    async stopServer() {
      try {
        const args = { ...this.nodes }
        args.portNumber = parseInt(this.server1.portNumber)

        await this.$store.dispatch('apiServer/stop', args)

        this.$toast.success('API server stopped successfully', { duration: 1000 })
      } catch (e) {
        console.log(e)
        throw e
      }
    },

    async getCloudUrl() {
      try {
        const args = { ...this.nodes }
        args.portNumber = parseInt(this.server1.portNumber)

        await this.$store.dispatch('apiServer/getCloudUrl', args)

        this.$toast.success('Cloud URL received successfully', { duration: 1000 })
      } catch (e) {
        console.log(e)
        throw e
      }
    },

    async sendNotification() {
      try {
        const args = { ...this.nodes }
        await this.$store.dispatch('apiServer/cloudSendNotification', args)
        // this.$toast.success('Cloud URL received successfully', {duration: 1000})
      } catch (e) {
        console.log(e)
        throw e
      }
    },
    clipboardSuccessHandler({ value, event }) {
      this.$toast.info('Copied to clipboard.').goAway(1000)
    },

    clipboardErrorHandler({ value, event }) {
      this.$toast.info('Clipboard copying failed.').goAway(1000)
    }

  },

  beforeCreated() {
  },
  watch: {},
  async created() {
    // this.server.serverLive = await this.sqlMgr.projectAPIServerIsLive();
  },
  mounted() {
  },
  beforeDestroy() {
  },
  destroy() {
  },
  directives: {},
  validate({ params }) {
    return true
  },
  head() {
    return {}
  },
  props: ['nodes']
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
