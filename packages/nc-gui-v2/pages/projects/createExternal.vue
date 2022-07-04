<script lang="ts" setup>

import { useNuxtApp, useRouter } from "#app";
import { ref } from "vue";

const name = ref('');
const loading = ref(false);
const valid = ref(false);
const projectDatasource = reactive({
  client:'mysql2',
  connection:{
    user: 'root',
    password: 'password',
    port: 3306,
    host: 'localhost',
    database: '',
  }
});

const { $api } = useNuxtApp();
const $router = useRouter();
const {user} = useUser()


const titleValidationRule = [
  v => !!v || "Title is required",
  v => v.length <= 50 || "Project name exceeds 50 characters"
];

const createProject = async () => {
  loading.value = true;
  try {

    const result= await $api.project.create({
      title: name.value,
      bases: [
        {
          type: projectDatasource.client,
          config: projectDatasource,
          // inflection_column: inflection.column_name,
          // inflection_table: inflection.table_name
        }
      ],
      external: true
    })

    await $router.push( `/dashboard/${result.id}`);
  } catch (e) {
    // todo: toast
    // this.$toast.error(await this._extractSdkResponseErrorMsg(e)).goAway(3000)
  }
  loading.value = false;

};

</script>

<template>
  <NuxtLayout>
    <div class="main  justify-center d-flex mx-auto" style="min-height: 600px;overflow: auto">
      <v-form ref="form" v-model="valid" @submit.prevent="createProject">
        <v-card style="width:530px;margin-top: 100px" class="mx-auto">

          <!-- Create Project -->
          <v-container class="pb-10 px-12" style="padding-top: 43px !important;">
            <h1 class="mt-4 mb-4 text-center">
              <!--            {{ $t('activity.createProject') }}-->
              Create Project
            </h1>
            <div class="mx-auto" style="width:350px">
              <!-- label="Enter Project Name" -->
              <!-- rule text: Required -->
              <v-text-field
                v-model="name"
                class="nc-metadb-project-name"
                label="Project name"
              />
              <!--                :rules="titleValidationRule"-->
            </div>


            <v-container fluid>
              <v-row>
                <v-col cols="6">
                  <v-select
                    :items="clientTypes"
                    item-title="text"
                    item-value="value"
                    v-model="projectDatasource.client"
                    class="nc-metadb-project-name"
                    label="Database client"
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model="projectDatasource.connection.host"
                    class="nc-metadb-project-name"
                    label="Host"
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model="projectDatasource.connection.port"
                    class="nc-metadb-project-name"
                    label="Port"
                    type="number"
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model="projectDatasource.connection.user"
                    class="nc-metadb-project-name"
                    label="Username"
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model="projectDatasource.connection.password"
                    class="nc-metadb-project-name"
                    type="password"
                    label="Password"
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model="projectDatasource.connection.database"
                    class="nc-metadb-project-name"
                    label="Database name"
                  />
                </v-col>
              </v-row>
            </v-container>

            <div class="text-center">
              <v-btn
                class="mt-3"
                large
                :loading="loading"
                color="primary"
                @click="createProject"
              >
                <v-icon class="mr-1 mt-n1">
                  mdi-rocket-launch-outline
                </v-icon>
                <!-- Create -->
                <!--                <span class="mr-1">{{ // $t("general.create") }}</span>-->
                <span class="mr-1"> Create project </span>
              </v-btn>
            </div>
          </v-container>
        </v-card>
      </v-form>
    </div>
  </NuxtLayout>
</template>

<style scoped>
/deep/ label {
  font-size: .75rem;
}

.wrapper {
  border: 2px solid var(--v-backgroundColor-base);
  border-radius: 4px;
}

.main {
  height: calc(100vh - 48px)
}
</style>
