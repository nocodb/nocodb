<script lang="ts" setup>
import { ref } from 'vue'
import { useNuxtApp, useRouter } from '#app'
import { extractSdkResponseErrorMsg } from "~/utils/errorUtils";

const name = ref('')
const loading = ref(false)
const valid = ref(false)

const { $api, $toast } = useNuxtApp()
const $router = useRouter()

const titleValidationRule = [(v:string) => !!v || 'Title is required', (v:string) => v.length <= 50 || 'Project name exceeds 50 characters']

const createProject = async () => {
  loading.value = true
  try {
    const result = await $api.project.create({
      title: name.value,
    })

    await $router.push(`/nc/${result.id}`)
  } catch (e:any) {
    // todo: toast
    $toast.error(await extractSdkResponseErrorMsg(e)).goAway(3000)
  }
  loading.value = false
}
</script>

<template>
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
            <v-text-field v-model="name" class="nc-metadb-project-name" label="Project name" />
            <!--                :rules="titleValidationRule" -->
          </div>
          <div class="text-center">
            <v-btn class="mt-3 mx-auto" large :loading="loading" color="primary" @click="createProject">
              <v-icon class="mr-1 mt-n1"> mdi-rocket-launch-outline </v-icon>
              <!-- Create -->
              <!--                <span class="mr-1">{{ // $t("general.create") }}</span> -->
              <span class="mr-1"> Create project </span>
            </v-btn>
          </div>
        </v-container>
      </v-card>
    </v-form>
  </div>
</template>

<style scoped>
/deep/ label {
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
