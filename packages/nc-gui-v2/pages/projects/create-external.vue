<script lang="ts" setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'
import { navigateTo, useNuxtApp } from '#app'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import { clientTypes, getDefaultConnectionConfig, getTestDatabaseName } from '~/utils/projectCreateUtils'
import MaterialSymbolsRocketLaunchOutline from '~icons/material-symbols/rocket-launch-outline'

const name = ref('')
const loading = ref(false)
const valid = ref(false)
const testSuccess = ref(true)
const projectDatasource = ref(getDefaultConnectionConfig('mysql2'))
const inflection = reactive({
  tableName: 'camelize',
  columnName: 'camelize',
})

const { $api, $e } = useNuxtApp()
const toast = useToast()
const { t } = useI18n()

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

    await navigateTo(`/nc/${result.id}`)
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
        toast.error(`${t('msg.error.dbConnectionFailed')} ${result.message}`)
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
    <v-form ref="formValidator" v-model="valid" class="h-full" @submit.prevent="createProject">
      <v-container fluid class="flex justify-center items-center h-5/6">
        <v-card max-width="600">
          <!-- Create Project -->
          <v-container class="pb-10 px-12">
            <h1 class="my-4 prose-lg text-center">
              {{ $t('activity.createProject') }}
            </h1>

            <v-row>
              <v-col offset="2" cols="8">
                <v-text-field
                  v-model="name"
                  :rules="titleValidationRule"
                  class="nc-metadb-project-name"
                  :label="$t('labels.projName')"
                />
              </v-col>

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
                <v-text-field v-model="projectDatasource.connection.host" density="compact" :label="$t('labels.hostAddress')" />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model="projectDatasource.connection.port"
                  density="compact"
                  :label="$t('labels.port')"
                  type="number"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field v-model="projectDatasource.connection.user" density="compact" :label="$t('labels.username')" />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model="projectDatasource.connection.password"
                  density="compact"
                  type="password"
                  :label="$t('labels.password')"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field v-model="projectDatasource.connection.database" density="compact" label="Database name" />
              </v-col>
            </v-row>

            <div class="d-flex justify-center" style="gap: 4px">
              <v-btn :disabled="!testSuccess" large :loading="loading" color="primary" @click="createProject">
                <MaterialSymbolsRocketLaunchOutline class="mr-1" />
                <span> {{ $t('general.create') }} </span>
              </v-btn>

              <!--              <v-btn small class="px-2"> -->
              <!--     todo:implement test connection -->
              <!--         <v-btn size="sm" class="text-sm text-capitalize">
                  &lt;!&ndash; Test Database Connection &ndash;&gt;
                  {{ $t('activity.testDbConn') }}
                </v-btn> -->
            </div>
          </v-container>
        </v-card>
      </v-container>
    </v-form>
  </NuxtLayout>
</template>

<style scoped></style>
