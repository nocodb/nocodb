<template>
  <div class="h-100 nc-auth-tab">
    <div class="h-100" style="width: 100%">
      <v-tabs height="40" color="x-active">
        <v-tab
          v-t="['c:sync-tab:airtable']"
        >
          <span class="caption text-capitalize">
            Airtable
          </span>
        </v-tab>
        <v-tab
          v-t="['c:sync-tab:stripe']"
        >
          <span class="caption text-capitalize">
            Stripe
          </span>
        </v-tab>
        <v-tab
          v-t="['c:sync-tab:salesforce']"
        >
          <span class="caption text-capitalize">
            Salesforce
          </span>
        </v-tab>

        <v-tab-item class="h-100 pa-10">
          <div>
            <!--    <v-dialog v-model="importModal" max-width="min(500px, 90%)">-->
            <v-card v-if="step === 1" class="py-6">
              <v-card-title class="title text-center justify-center">
                <span @dblclick="$set(syncSource.details,'syncViews',true)">Credentials<span
                  v-if="syncSource && syncSource.details && syncSource.details.syncViews"
                >.</span>
                </span>
              </v-card-title>

              <!--
          title: '',
          type: '',
          details: '',
          deleted: '',
          order: '',
          project_id: ''-->
              <v-form v-model="valid">
                <div v-if="syncSource" class="px-10 mt-1 mx-auto" style="max-width: 400px">
                  <!--                <v-text-field v-model="syncSource.title" outlined dense label="Title" class="caption" />-->
                  <v-text-field
                    v-model="syncSource.details.apiKey"
                    outlined
                    dense
                    label="Api Key"
                    class="caption"
                    :rules="[v=> !!v || 'Api Key is required']"
                  />
                  <v-text-field
                    v-model="syncSourceUrlOrId"
                    outlined
                    dense
                    label="Shared Base ID / URL"
                    class="caption"
                    :rules="[v=> !!v || 'Shared Base ID / URL is required']"
                  />
                <!--                <v-select
                  v-model="syncSource.details.syncInterval"
                  :items="['15mins','30mins','1hr', '24hr']"
                  outlined
                  dense
                  label="Sync interval"
                  class="caption"
                />
                <v-select
                  v-model="syncSource.details.syncDirection"
                  :items="['Airtable to NocoDB','2 way']"
                  outlined
                  dense
                  label="Shared direction"
                  class="caption"
                />
                <v-text-field
                  v-model="syncSource.details.syncRetryCount"
                  type="number"
                  outlined
                  dense

                  label="Shared retry count"
                  class="caption"
                />-->
                </div>
              </v-form>   <v-card-actions class="justify-center pb-6">
                <v-btn
                  v-t="['c:sync-airtable:save']"
                  :disabled="!valid"
                  small
                  outlined
                  @click="createOrUpdate"
                >
                  Save
                </v-btn>
                <v-btn
                  v-t="['c:sync-airtable:save-and-sync']"
                  :disabled="!valid"
                  small
                  outlined
                  @click="saveAndSync"
                >
                  Save & Sync
                </v-btn>
              </v-card-actions>
            </v-card>

            <v-card
              v-if="step === 2"
              class="py-4 mt-4"
            >
              <v-card-title class="title text-center justify-center">
                Logs
              </v-card-title>
              <v-card
                ref="log"
                dark
                class="mt-2 mx-4 px-2 elevation-0 green--text"
                height="500"
                style="overflow-y: auto"
              >
                <div v-for="({msg , status}, i) in progress" :key="i">
                  <v-icon v-if="status==='FAILED'" color="red" size="15">
                    mdi-close-circle-outline
                  </v-icon>
                  <v-icon v-else color="green" size="15">
                    mdi-currency-usd
                  </v-icon>
                  <span class="caption nc-text">{{ msg }}</span>
                </div>
                <div
                  v-if="!progress || !progress.length || progress[progress.length-1].status !== 'COMPLETED' && progress[progress.length-1].status !== 'FAILED'"
                  class=""
                >
                  <v-icon color="green" size="15">
                    mdi-loading mdi-spin
                  </v-icon>
                  <span class="caption nc-text">Syncing
                  </span>
                  <!--                  <div class="nc-progress" />-->
                </div>
              </v-card>

              <div
                v-if="progress && progress.length && progress[progress.length-1].status === 'COMPLETED'"
                class="pa-4 pt-8 text-center"
              >
                <v-btn small color="primary" @click="$emit('close')">
                  Go to dashboard
                </v-btn>
              </div>
            </v-card>
          </div>

          <!--          <v-card-actions-->
          <!--            v-if="progress &&progress.length&& progress[progress.length-1].msg === 'completed'"-->
          <!--            class="justify-center py-3"-->
          <!--          >-->
          <!--            <v-btn small outlined @click="progress=[], step=0,importModal=false">-->
          <!--              Navigate to project-->
          <!--            </v-btn>-->
          <!--          </v-card-actions>-->
          <!--    </v-dialog>-->
        </v-tab-item>
      </v-tabs>
    </div>
  </div>
</template>

<script>
import io from 'socket.io-client'

export default {
  name: 'ImportFromAirtable',
  data: () => ({
    valid: false,
    socket: null,
    step: 1,
    progress: [],
    syncSource: null,
    syncSourceUrlOrId: ''
  }),
  watch: {
    syncSourceUrlOrId(v) {
      if (this.syncSource && this.syncSource.details) {
        const m = v.match(/airtable\.com\/([\w.-]+)/)
        this.syncSource.details.shareId = m ? m[1] : v
      }
    }
  },
  created() {
    this.socket = io(new URL(this.$axios.defaults.baseURL, window.location.href.split(/[?#]/)[0]).href, {
      extraHeaders: { 'xc-auth': this.$store.state.users.token }
    })
    this.socket.on('connect_error', () => {
      this.socket.disconnect()
      this.socket = null
    })

    const socket = this.socket
    socket.on('connect', function(data) {
      console.log(socket.id)
      console.log('socket connected', data)
    })

    socket.on('progress', (d) => {
      this.progress.push(d)

      this.$nextTick(() => {
        if (this.$refs.log) {
          const el = this.$refs.log.$el
          el.scrollTop = el.scrollHeight
        }
      })

      if (d.status === 'COMPLETED') {
        this.$store.dispatch('project/_loadTables', {
          dbKey: '0.projectJson.envs._noco.db.0',
          key: '0.projectJson.envs._noco.db.0.tables',
          _nodes: {
            dbAlias: 'db',
            env: '_noco',
            type: 'tableDir'
          }
        }).then(() => this.$store.dispatch('tabs/loadFirstTableTab'))
      }
    })
    this.loadSyncSrc()
  },
  beforeDestroy() {
    if (this.socket) {
      this.socket.disconnect()
    }
  },
  methods: {
    async saveAndSync() {
      await this.createOrUpdate()
      this.sync()
    },
    sync() {
      this.step = 2
      this.$axios.post(`/api/v1/db/meta/syncs/${this.syncSource.id}/trigger`, this.payload, {
        params: {
          id: this.socket.id
        }
      })
    },
    async loadSyncSrc() {
      const { data: { list: srcs } } = await this.$axios.get(`/api/v1/db/meta/projects/${this.projectId}/syncs`)
      if (srcs && srcs[0]) {
        srcs[0].details = srcs[0].details || {}
        this.syncSource = srcs[0]
        this.syncSourceUrlOrId = srcs[0].details.shareId
      } else {
        this.syncSource = {
          type: 'Airtable',
          details: {
            syncInterval: '15mins',
            syncDirection: 'Airtable to NocoDB',
            syncRetryCount: 1,

            syncViews: false,

            apiKey: '',
            shareId: ''
          }
        }
      }
    },
    async createOrUpdate() {
      try {
        const { id, ...payload } = this.syncSource
        if (id) {
          await this.$axios.patch(`/api/v1/db/meta/syncs/${id}`, payload)
        } else {
          this.syncSource = (await this.$axios.post(`/api/v1/db/meta/projects/${this.projectId}/syncs`, payload)).data
        }
      } catch (e) {
        this.$toast.error(await this._extractSdkResponseErrorMsg(e)).goAway(3000)
      }
    }
  }
}
</script>

<style scoped>

.nc-progress {
  margin-left: 12px;
  position: relative;
  width: 5px;
  height: 5px;
  border-radius: 5px;
  background-color: #9880ff;
  color: #9880ff;
  animation: dotFlashing 1s infinite linear alternate;
  animation-delay: .5s;
}

.nc-progress::before, .nc-progress::after {
  content: '';
  display: inline-block;
  position: absolute;
  top: 0;
}

.nc-progress::before {
  left: -7.5px;
  width: 5px;
  height: 5px;
  border-radius: 5px;
  background-color: #9880ff;
  color: #9880ff;
  animation: dotFlashing 1s infinite alternate;
  animation-delay: 0s;
}

.nc-progress::after {
  left: 7.5px;
  width: 5px;
  height: 5px;
  border-radius: 5px;
  background-color: var(--v-primary-base);
  color: var(--v-primary-base);
  animation: dotFlashing 1s infinite alternate;
  animation-delay: 1s;
}

@keyframes dotFlashing {
  0% {
    background-color: var(--v-primary-base);
  }
  50%,
  100% {
    background-color: var(--v-backgroundColor-base);
  }
}

</style>
