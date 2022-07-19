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
  {
    required: true,
    message: 'Title is required',
  },
  {
    validator(rule: any, value: any, callback: (errMsg?: string) => void) {
      if (value?.length > 50) {
        callback('Project name exceeds 50 characters')
      }
      callback()
    },
  },
]

const formState = reactive({
  title: '',
})

const createProject = async () => {
  loading.value = true
  try {
    const result = await $api.project.create({
      title: formState.title,
    })

    await navigateTo(`/nc/${result.id}`)
  } catch (e: any) {
    $toast.error(await extractSdkResponseErrorMsg(e)).goAway(3000)
  }
  loading.value = false
}
</script>

<template>
  <a-card class="w-[500px] mx-auto !mt-100px">
    <h3 class="text-3xl text-center font-semibold mb-2">{{ $t('activity.createProject') }}</h3>

    <a-form :model="formState" name="basic" layout="vertical" autocomplete="off" @submit="createProject">
      <a-form-item :label="$t('labels.projName')" name="title" :rules="nameValidationRules" class="my-10">
        <a-input v-model:value="formState.title" name="title" class="nc-metadb-project-name" />
      </a-form-item>

      <a-form-item style="text-align: center" class="mt-2">
        <a-button type="primary" html-type="submit" class="mx-auto flex justify-self-center">
          <MaterialSymbolsRocketLaunchOutline class="mr-1" />
          <span> {{ $t('general.create') }} </span></a-button
        >
      </a-form-item>
    </a-form>
  </a-card>
</template>
