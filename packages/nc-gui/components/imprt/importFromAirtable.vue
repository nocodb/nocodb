<template>
  <div class="h-100 nc-auth-tab">
    <div class="h-100" style="width: 100%">
      <v-tabs height="40" color="x-active">
        <v-tab>
          <span class="caption text-capitalize">
            Airtable
          </span>
        </v-tab>
        <v-tab-item class="h-100">
          <div>
            <!--    <v-dialog v-model="importModal" max-width="min(500px, 90%)">-->
            <v-card v-if="step === 1">
              <v-card-title class="justify-center">
                Airtable import
              </v-card-title>
              <!--
          title: '',
          type: '',
          details: '',
          deleted: '',
          order: '',
          project_id: ''-->
              <div v-if="syncSource" class="px-10 mt-2">
                <v-text-field v-model="syncSource.title" outlined dense label="Title" class="caption" />
                <v-text-field v-model="syncSource.details.apiKey" outlined dense label="Api Key" class="caption" />
                <v-text-field v-model="syncSource.details.shareId" outlined dense label="Shared Base ID" class="caption" />
                <v-select
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
                />
              </div>
              <v-card-actions class="justify-center pb-6">
                <v-btn
                  small
                  outlined
                  @click="createOrUpdate"
                >
                  Save
                </v-btn>
                <v-btn
                  small
                  outlined
                  @click="saveAndSync"
                >
                  Save & Sync
                </v-btn>
              </v-card-actions>
            </v-card>

            <v-card v-else-if="step === 2" class="" min-height="300">
              <v-card-title class="justify-center">
                Airtable import
              </v-card-title>

              <div class="mt-2 px-10">
                <div v-for="({msg , status}, i) in progress" :key="i">
                  <v-icon v-if="status==='FAILED'" color="red">
                    mdi-close-circle-outline
                  </v-icon>
                  <v-icon v-else color="green">
                    mdi-check-circle-outline
                  </v-icon>
                  <span class="caption nc-text">{{ msg }}</span>
                </div>
                <div v-if="!progress || !progress.length || progress[progress.length-1].msg !== 'completed' && progress[progress.length-1].status !== 'FAILED'">
                  <v-icon color="green">
                    mdi-loading mdi-spin
                  </v-icon>
                  <span class="caption nc-text">Syncing<span class="nc-progress" />
                  </span>
                </div>

                <v-icon color="green">
                  mdi-loading mdi-spin
                </v-icon>
                <span class="caption nc-text">Syncing
                </span><div class="nc-progress" />
              </div>
            </v-card>
          </div>

          <v-card-actions
            v-if="progress &&progress.length&& progress[progress.length-1].msg === 'completed'"
            class="justify-center py-3"
          >
            <v-btn small outlined @click="progress=[], step=0,importModal=false">
              Navigate to project
            </v-btn>
          </v-card-actions>
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
    socket: null,
    step: 1,
    progress: [],
    syncSource: null
  }),
  created() {
    this.socket = io('http://localhost:9000')
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
      this.$axios.post(`http://localhost:8080/api/v1/db/meta/syncs/${this.syncSource.id}/trigger`, this.payload, {
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
      } else {
        this.syncSource = {
          type: 'Airtable',
          details: {
            syncInterval: '15mins',
            syncDirection: 'Airtable to NocoDB',
            syncRetryCount: 1
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
          await this.$axios.post(`/api/v1/db/meta/projects/${this.projectId}/syncs`, payload)
        }
      } catch (e) {
        this.$toast.error(await this._extractSdkResponseErrorMsg(e)).goAway(3000)
      }
    }
  }
}
</script>

<style scoped>

@keyframes progress {
  0% {
    content: '';
  }
  25% {
    content: '..';
  }
  50% {
    content: '...';
  }
  75% {
    content: '....';
  }
  100% {
    content: '>>';
  }
}
.nc-progress {
  display: block;
  width: 100px;
  height: 30px;
  content: '>>';
}
.nc-progress::after{
  animation: progress 3s linear infinite alternate;
}
</style>
