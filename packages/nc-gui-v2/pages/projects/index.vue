<script setup lang="ts">
import { useRouter } from '#app'

const { $api } = useNuxtApp()
const { user } = useUser()

const router = useRouter()

const projects = ref()

const loadProjects = async () => {
  const projectsResponse = await $api.project.list({}, {
    headers: {
      'xc-auth': user.token,
    },
  })
  projects.value = projectsResponse.list
}

const navigateToDashboard = async (project) => {
  await router.push(`/dashboard/${project.id}`)
}

onMounted(async () => {
  await loadProjects()
})
</script>

<template>
  <NuxtLayout>
    <v-navigation-drawer :permanent="true" />
    <v-main>
      <v-container>
        <div class="pa-2 d-flex mb-10">
          <v-spacer />
          <v-btn size="small" class="caption text-capitalize mr-2" color="primary" @click="router.push('/projects/create')">
            Create Project
          </v-btn>
          <v-btn size="small" class="caption text-capitalize mr-2" color="primary" @click="router.push('/projects/create')">
            Create External Project
          </v-btn>
        </div><v-row>
          <v-col v-for="project in projects" :key="project.id" cols="4">
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
    </v-main>
  </NuxtLayout>
</template>
