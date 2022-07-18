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

const formState = reactive({
  username: '',
  password: '',
  remember: true,
})
const onFinish = (values: any) => {
  console.log('Success:', values)
}

const onFinishFailed = (errorInfo: any) => {
  console.log('Failed:', errorInfo)
}
</script>

<template>
  <a-card class="w-[500px] mx-auto mt-10">

    <h3 class="text-3xl text-center"> {{ $t('activity.createProject') }}</h3>

    <a-form
      :model="formState"
      name="basic"
      layout="vertical"
      autocomplete="off"
      @finish="onFinish"
      @finishFailed="onFinishFailed"
    >
      <a-form-item
        :label="$t('labels.projName')"
        name="title"
        :rules="[{ required: true, message: 'Please input your username!' }]"
      >
        <a-input  class="nc-metadb-project-name" v-model:value="formState.username" />
      </a-form-item>

      <a-form-item style="text-align: center">
        <a-button type="primary" html-type="submit" class="mx-auto flex justify-self-center">
          <MaterialSymbolsRocketLaunchOutline class="mr-1" /> <span> {{ $t('general.create') }} </span></a-button
        >
      </a-form-item>
    </a-form>
  </a-card>
  <!--    <v-form ref="formValidator" v-model="valid" class="h-full" @submit.prevent="createProject">
      <v-container fluid class="flex justify-center items-center h-3/4">
        <v-card max-width="500">
          <v-container class="pb-10 px-12">
            <h1 class="my-4 prose-lg text-center">
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
  </NuxtLayout> -->
</template>
