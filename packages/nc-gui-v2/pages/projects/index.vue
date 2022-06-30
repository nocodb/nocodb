<template>
  <div>

    <div class="grid">
      <div class="col-3 p-3" v-for="project in projects" :key="project.id">

        <Card @click="navigateToDashboard(project)">
          <template #content>
            <div class="text-center">
              <h3>{{ project.title }}</h3>
            </div>
          </template>
        </Card>

      </div>
    </div>

  </div>
</template>

<script setup lang="ts">

import {Api} from "nocodb-sdk";

const {$api, $router}= useNuxtApp()
const projects = ref()
const {user} = useUser()

const loadProjects = async () => {
  const projectsResponse = await $api.project.list({}, {
    headers: {
      'xc-auth': user.token
    }
  })
  projects.value = projectsResponse.list
}

const navigateToDashboard = async (project) => {
  await $router.push({
    path: '/dashboard/'  + project.id
  })
}

onMounted(async () => {
  await loadProjects()
})
</script>

<style scoped>

</style>
