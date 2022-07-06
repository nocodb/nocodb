<script lang="ts" setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'
import { useNuxtApp, useRouter } from '#app'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import { clientTypes, getDefaultConnectionConfig, getTestDatabaseName } from '~/utils/projectCreateUtils'

const name = ref('')
const loading = ref(false)
const valid = ref(false)
const testSuccess = ref(false)
const projectDatasource = ref(getDefaultConnectionConfig('mysql2'))
const inflection = reactive({
  tableName: 'camelize',
  columnName: 'camelize',
})

const $router = useRouter()
const { $api, $e } = useNuxtApp()
const toast = useToast()
const { t: $t } = useI18n()

const titleValidationRule = [
  (v: string) => !!v || 'Title is required',
  (v: string) => v.length <= 50 || 'Project name exceeds 50 characters',
]

const createProject = async () => {
  loading.value = true
  try {
    const result = await $api.project.create({
      title: name.value,
      bases: [
        {
          type: projectDatasource.value.client,
          config: projectDatasource.value,
          inflection_column: inflection.columnName,
          inflection_table: inflection.tableName,
        },
      ],
      external: true,
    })

    await $router.push(`/nc/${result.id}`)
  } catch (e: any) {
    // todo: toast
    toast.error(await extractSdkResponseErrorMsg(e))
  }
  loading.value = false
}

const testConnection = async () => {
  $e('a:project:create:extdb:test-connection', [])
  try {
    // this.handleSSL(projectDatasource)

    if (projectDatasource.value.client === 'sqlite3') {
      testSuccess.value = true
    } else {
      const testConnectionConfig = {
        ...projectDatasource,
        connection: {
          ...projectDatasource.value.connection,
          database: getTestDatabaseName(projectDatasource.value),
        },
      }

      const result = await $api.utils.testConnection(testConnectionConfig)

      if (result.code === 0) {
        testSuccess.value = true
      } else {
        testSuccess.value = false
        toast.error($t('msg.error.dbConnectionFailed') + result.message)
      }
    }
  } catch (e: any) {
    testSuccess.value = false
    toast.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <NuxtLayout>
    <div class="main justify-center d-flex mx-auto" style="min-height: 600px; overflow: auto">
      <v-form ref="form" v-model="valid" @submit.prevent="createProject">
        <v-card style="width: 530px; margin-top: 100px" class="mx-auto">
          <!-- Create Project -->
          <v-container class="pb-10 px-12" style="padding-top: 43px !important">
            <h1 class="mt-4 mb-4 text-center">
              <!--            {{ $t('activity.createProject') }} -->
              Create Project
            </h1>
            <div class="mx-auto" style="width: 350px">
              <!-- label="Enter Project Name" -->
              <!-- rule text: Required -->
              <v-text-field v-model="name" :rules="titleValidationRule" class="nc-metadb-project-name" label="Project name" />
              <!--                :rules="titleValidationRule" -->
            </div>

            <v-container fluid>
              <v-row>
                <v-col cols="6">
                  <v-select
                    v-model="projectDatasource.client"
                    density="compact"
                    :items="clientTypes"
                    item-title="text"
                    item-value="value"
                    class="nc-metadb-project-name"
                    label="Database client"
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="projectDatasource.connection.host" density="compact" label="Host" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="projectDatasource.connection.port" density="compact" label="Port" type="number" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="projectDatasource.connection.user" density="compact" label="Username" />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model="projectDatasource.connection.password"
                    density="compact"
                    type="password"
                    label="Password"
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="projectDatasource.connection.database" density="compact" label="Database name" />
                </v-col>

                <!--                <v-col cols="6">
                  <v-text-field
                    v-model="inflection.tableName"
                    density="compact"
                    type="password"
                    label="Password"
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model="inflection.columnName"
                    density="compact"
                    label="Database name"
                  />
                </v-col> -->
              </v-row>
            </v-container>

            <div class="d-flex justify-center" style="gap: 4px">
              <v-btn :disabled="!testSuccess" class="" large :loading="loading" color="primary" @click="createProject">
                <v-icon class="mr-1 mt-n1"> mdi-rocket-launch-outline</v-icon>
                <!-- Create -->
                <span class="mr-1">{{ $t('general.create') }} </span>
              </v-btn>

              <v-btn size="sm" class="text-sm text-capitalize">
                <!-- Test Database Connection -->
                {{ $t('activity.testDbConn') }}
              </v-btn>
            </div>
          </v-container>
        </v-card>
      </v-form>
    </div>
  </NuxtLayout>
</template>

<style scoped></style>
