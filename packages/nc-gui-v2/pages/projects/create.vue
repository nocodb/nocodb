<script lang="ts" setup>
import { ref } from 'vue'
import { navigateTo, useNuxtApp } from '#app'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import MaterialSymbolsRocketLaunchOutline from '~icons/material-symbols/rocket-launch-outline'

const name = ref('')
const loading = ref(false)
const valid = ref(false)

const { $api, $toast } = useNuxtApp()

const nameValidationRules = [
  (v: string) => !!v || 'Title is required',
  (v: string) => v.length <= 50 || 'Project name exceeds 50 characters',
]

const createProject = async () => {
  loading.value = true
  try {
    const result = await $api.project.create({
      title: name.value,
    })

    await navigateTo(`/nc/${result.id}`)
  } catch (e: any) {
    $toast.error(await extractSdkResponseErrorMsg(e)).goAway(3000)
  }
  loading.value = false
}
</script>

<template>
  <NuxtLayout>
    <v-form ref="form" v-model="valid" @submit.prevent="createProject">
      <v-container fluid class="d-flex justify-center align-center h-75">
        <v-card max-width="500">
          <v-container class="pb-10 px-12">
            <h1 class="mt-4 mb-4 text-center">
              {{ $t('activity.createProject') }}
            </h1>
            <div class="mx-auto" style="width: 350px">
              <v-text-field
                v-model="name"
                class="nc-metadb-project-name"
                :rules="nameValidationRules"
                :label="$t('labels.projName')"
              />
            </div>
            <v-btn class="mx-auto" large :loading="loading" color="primary" @click="createProject">
              <MaterialSymbolsRocketLaunchOutline class="mr-1" />
              <span> {{ $t('general.create') }} </span>
            </v-btn>
          </v-container>
        </v-card>
      </v-container>
    </v-form>
  </NuxtLayout>
</template>

<style scoped>
:deep(label) {
  font-size: 0.75rem;
}

.wrapper {
  border: 2px solid var(--v-backgroundColor-base);
  border-radius: 4px;
}

.main {
  height: calc(100vh - 48px);
}
</style>
