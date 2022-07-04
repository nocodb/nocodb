<script lang="ts" setup>
import { ref } from 'vue'
import { useToast } from 'vue-toastification'
import { useI18n } from 'vue-i18n'
import { useNuxtApp, useRouter } from '#app'
import { extractSdkResponseErrorMsg } from '~/helpers/errorUtils'

const clientTypes = [
  {
    text: 'MySql',
    value: 'mysql2',
  }, {
    text: 'MSSQL',
    value: 'mssql',
  }, {
    text: 'PostgreSQL',
    value: 'pg',
  }, {
    text: 'SQLite',
    value: 'sqlite',
  },
]

const name = ref('')
const loading = ref(false)
const valid = ref(false)
const projectDatasource = reactive({
  client: 'mysql2',
  connection: {
    user: 'root',
    password: 'password',
    port: 3306,
    host: 'localhost',
    database: '',
  },
})
const inflection = reactive({
  tableName: 'camelize',
  columnName: 'camelize',
})

const $router = useRouter()
const { $api } = useNuxtApp()
const { user } = useUser()
const toast = useToast()

const titleValidationRule = [
  v => !!v || 'Title is required',
  v => v.length <= 50 || 'Project name exceeds 50 characters',
]

const createProject = async () => {
  loading.value = true
  try {
    const result = await $api.project.create({
      title: name.value,
      bases: [
        {
          type: projectDatasource.client,
          config: projectDatasource,
          inflection_column: inflection.columnName,
          inflection_table: inflection.tableName,
        },
      ],
      external: true,
    })

    await $router.push(`/dashboard/${result.id}`)
  }
  catch (e) {
    // todo: toast
    toast.error(await extractSdkResponseErrorMsg(e))
  }
  loading.value = false
}
</script>

<template>
  <NuxtLayout>
    <div class="main  justify-center d-flex mx-auto" style="min-height: 600px;overflow: auto">
      <v-form ref="form" v-model="valid" @submit.prevent="createProject">
        <v-card style="width:530px;margin-top: 100px" class="mx-auto">
          <!-- Create Project -->
          <v-container class="pb-10 px-12" style="padding-top: 43px !important;">
            <h1 class="mt-4 mb-4 text-center">
              <!--            {{ $t('activity.createProject') }} -->
              Create Project
            </h1>
            <div class="mx-auto" style="width:350px">
              <!-- label="Enter Project Name" -->
              <!-- rule text: Required -->
              <v-text-field
                v-model="name"
                :rules="titleValidationRule"
                class="nc-metadb-project-name"
                label="Project name"
              />
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
                  <v-text-field
                    v-model="projectDatasource.connection.host"
                    density="compact"
                    label="Host"
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model="projectDatasource.connection.port"
                    density="compact"
                    label="Port"
                    type="number"
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model="projectDatasource.connection.user"
                    density="compact"
                    label="Username"
                  />
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
                  <v-text-field
                    v-model="projectDatasource.connection.database"
                    density="compact"
                    label="Database name"
                  />
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

            <div class="text-center">
              <v-btn
                class="mt-3 mx-auto"
                large
                :loading="loading"
                color="primary"
                @click="createProject"
              >
                <v-icon class="mr-1 mt-n1">
                  mdi-rocket-launch-outline
                </v-icon>
                <!-- Create -->
                <span class="mr-1">{{ $t("general.create") }} </span>
              </v-btn>
            </div>
          </v-container>
        </v-card>
      </v-form>
    </div>
  </NuxtLayout>
</template>

<style scoped>
</style>
