<template>
  <NuxtLayout>
    <v-navigation-drawer color="" permanent></v-navigation-drawer>
    <v-main>
      <v-container>


        <div class="pa-2 d-flex mb-10">
          <v-spacer></v-spacer>
          <v-btn size="small" class="caption text-capitalize mr-2" color="primary" @click="createProject">Create Project</v-btn>
          <v-btn size="small" class="caption text-capitalize mr-2" color="primary" @click="createExtProject">Create External Project</v-btn>
        </div>

        <!--  tod
        o: move to layout or create a reusable component -->
        <!--  <div class="nc-container">-->
        <!--    <div class="nc-topbar shadow-2">-->
        <!--    </div>-->
        <!--    <div class="nc-sidebar shadow-2 p-4 overflow-y-auto">-->

        <!--    </div>-->
        <!--    <div class="nc-content p-4 overflow-auto">-->
        <v-row>
          <v-col cols="4" v-for="project in projects" :key="project.id">

            <v-card @click="navigateToDashboard(project)">
              <v-card-title>
                <div class="text-center">
                  <h3>{{ project.title }}</h3>
                </div>
              </v-card-title>
            </v-card>

          </v-col>
        </v-row>
      </v-container>
      <!--    </div>-->
      <!--  </div>-->


    </v-main>
  </NuxtLayout>
</template>

<script setup lang="ts">

import { useRouter } from "#app";

const { $api } = useNuxtApp();
const { user } = useUser();


const $router = useRouter();

const projects = ref();

const loadProjects = async () => {
  const projectsResponse = await $api.project.list();
  projects.value = projectsResponse.list;
};

const navigateToDashboard = async (project) => {
  await $router.push("/dashboard/" + project.id);
};

const createProject =()=> $router.push('/projects/create')
const createExtProject =()=> $router.push('/projects/createExternal')

onMounted(async () => {
  await loadProjects();
});
</script>

<style scoped lang="scss">
//.nc-container {
//  .nc-topbar {
//    position: fixed;
//    top: 0;
//    left: 0;
//    height: 50px;
//    width: 100%;
//    z-index: 5;
//  }
//
//  .nc-sidebar {
//    position: fixed;
//    top: 50px;
//    left: 0;
//    height: calc(100% - 50px);
//    width: 250px;
//  }
//
//  .nc-content {
//    position: fixed;
//    top: 50px;
//    left: 250px;
//    height: calc(100% - 50px);
//    width: calc(100% - 250px);
//  }
//}
</style>
