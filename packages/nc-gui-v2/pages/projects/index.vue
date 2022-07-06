<script setup lang="ts">
import { navigateTo } from '#app'

const { $api } = useNuxtApp()

const response = await $api.project.list({})
const projects = ref(response.list)
</script>

<template>
  <NuxtLayout>
    <template #sidebar>
      <v-navigation-drawer :permanent="true" />
    </template>

    <v-container>
      <div class="pa-2 d-flex mb-10">
        <v-spacer />
        <v-btn size="small" class="caption text-capitalize mr-2" color="primary" @click="navigateTo('/projects/create')">
          {{ $t('activity.createProject') }}
        </v-btn>
        <v-btn size="small" class="caption text-capitalize mr-2" color="primary" @click="navigateTo('/projects/create')">
          {{ $t('activity.createProjectExtended.extDB') }}
        </v-btn>
      </div>
      <v-row>
        <v-col v-for="project of projects" :key="project.id" cols="4">
          <v-card @click="navigateTo(`/nc/${project.id}`)">
            <v-card-title>
              <div class="text-center">
                <h3>{{ project.title }}</h3>
              </div>
            </v-card-title>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </NuxtLayout>
</template>
