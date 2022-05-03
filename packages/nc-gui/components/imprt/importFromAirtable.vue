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

              <div class="px-10 mt-2">
                <v-text-field v-model="payload.airtableApiKey" outlined dense label="Api Key" />
                <v-text-field v-model="payload.airtableShareId" outlined dense label="Shared Base ID" />
                <v-text-field v-model="payload.authToken" outlined dense label="Auth Token" />
                <v-text-field v-model="payload.baseURL" outlined dense label="Base Url" />
                <v-text-field v-model="payload.projectName" outlined dense label="Project name" />
                <!--                <v-select-->
                <!--                  outlined-->
                <!--                  dense-->
                <!--                  label="Sync after every"-->
                <!--                  :items="['5 mins', '15 mins', '30 mins']"-->
                <!--                />-->
              </div>
              <v-card-actions class="justify-center pb-6">
                <v-btn
                  small
                  outlined
                  @click="importFromAirtable"
                >
                  Import
                </v-btn>
              </v-card-actions>
            </v-card>

            <v-card v-else-if="step === 2" class="" min-height="300">
              <v-card-title class="justify-center">
                Airtable import
              </v-card-title>

              <div class="mt-2 px-10">
                <div v-for="({msg}, i) in progress" :key="i">
                  <v-icon color="green">
                    mdi-check-circle-outline
                  </v-icon>
                  <span class="caption nc-text">{{ msg }}</span>
                </div>
                <div v-if="!progress || !progress.length || progress[progress.length-1].msg !== 'completed'">
                  <v-icon color="green">
                    mdi-loading mdi-spin
                  </v-icon>
                  <span class="caption nc-text">Migrating...</span>
                </div>
              </div>

              <v-card-actions v-if="progress &&progress.length&& progress[progress.length-1].msg === 'completed'" class="justify-center py-3">
                <v-btn small outlined @click="progress=[], step=0,importModal=false">
                  Navigate to project
                </v-btn>
              </v-card-actions>
            </v-card>
            <!--    </v-dialog>-->
          </div>
        </v-tab-item>

        <!--        <template v-if="_isUIAllowed('apiTokenTab')">-->
        <!--          <v-tab>-->
        <!--            <span class="caption text-capitalize">-->
        <!--              &lt;!&ndash; API Tokens Management &ndash;&gt;-->
        <!--              {{ $t('title.apiTokenMgmt') }}-->
        <!--            </span>-->
        <!--          </v-tab>-->
        <!--          <v-tab-item>-->
        <!--            <api-tokens :nodes="nodes" />-->
        <!--          </v-tab-item>-->
        <!--        </template>-->
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
    payload: {
      baseURL: '',
      authToken: '',
      projectName: '',
      projectId: '',
      airtableApiKey: '',
      airtableShareId: ''
    }
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
    this.payload = {
      baseURL: this.$store.state.project.projectInfo.ncSiteUrl,
      authToken: this.$store.state.users.token,
      projectName: this.projectName,
      projectId: this.projectId,
      airtableApiKey: '',
      airtableShareId: ''
    }
  },
  methods: {
    importFromAirtable() {
      this.step = 2
      this.$axios.$post('http://localhost:8080/api/v1/db/meta/import/airtable?id=' + this.socket.id, this.payload)
    }
  }
}
</script>

<style scoped>

</style>
