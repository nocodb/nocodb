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
          <h4 class="title text-center mt-4">
            Airtable import
          </h4>

          <v-stepper non-linear dense class=" elevation-0  my-3">
            <v-stepper-header v-model="step">
              <v-stepper-step
                class="caption"
                :complete="step > 0"
                step="1"
              >
                Configure Airtable Base
              </v-stepper-step>

              <v-divider />

              <v-stepper-step
                class="caption"
                :complete="step > 1"
                step="2"
              >
                Sync
              </v-stepper-step>

              <v-divider />

              <v-stepper-step
                step="3"
                :complete="step > 2"
                class="caption"
              >
                Completed sync
              </v-stepper-step>
            </v-stepper-header>
          </v-stepper>

          <div>
            <!--    <v-dialog v-model="importModal" max-width="min(500px, 90%)">-->
            <v-card>
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
                  :disabled="step !== 1"
                  small
                  outlined
                  @click="createOrUpdate"
                >
                  Save
                </v-btn>
                <v-btn
                  :disabled="step !== 1"
                  small
                  outlined
                  @click="saveAndSync"
                >
                  Save & Sync
                </v-btn>
              </v-card-actions>
            </v-card>

            <v-card v-if="step === 2" class="" min-height="300">
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
                <div
                  v-if="!progress || !progress.length || progress[progress.length-1].msg !== 'completed' && progress[progress.length-1].status !== 'FAILED'"
                  class="d-flex align-center"
                >
                  <v-icon color="green">
                    mdi-loading mdi-spin
                  </v-icon>
                  <span class="caption nc-text">Syncing
                  </span>
                  <!--                  <div class="nc-progress" />-->
                </div>
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
  margin-left:12px;
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
