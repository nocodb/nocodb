<script lang="ts" setup>
import { onMounted, onUpdated } from '@vue/runtime-core'
import type { Form } from 'ant-design-vue'
import { useToast } from 'vue-toastification'
import { nextTick, ref } from '#imports'
import { navigateTo, useNuxtApp } from '#app'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import { projectTitleValidator } from '~/utils/projectCreateUtils'
import MaterialSymbolsRocketLaunchOutline from '~icons/material-symbols/rocket-launch-outline'

const name = ref('')
const loading = ref(false)
const valid = ref(false)

const { $api, $state } = useNuxtApp()
const toast = useToast()

const nameValidationRules = [
  {
    required: true,
    message: 'Title is required',
  },
  projectTitleValidator,
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

    debugger
    await navigateTo(`/nc/${result.id}`)
  } catch (e: any) {
    debugger
    toast.error(await extractSdkResponseErrorMsg(e))
  }
  loading.value = false
}

const form = ref<typeof Form>()

// hide sidebar
$state.sidebarOpen.value = false

// select and focus title field on load
onMounted(async () => {
  nextTick(() => {
    // todo: replace setTimeout and follow better approach
    setTimeout(() => {
      const input = form.value?.$el?.querySelector('input[type=text]')
      input.setSelectionRange(0, formState.title.length)
      input.focus()
    }, 500)
  })
})
</script>

<template>
  <a-card class="w-[500px] mx-auto !mt-100px shadow-md">
    <h3 class="text-3xl text-center font-semibold mb-2">{{ $t('activity.createProject') }}</h3>

    <a-form ref="form" :model="formState" name="basic" layout="vertical" autocomplete="off" @finish="createProject">
      <a-form-item :label="$t('labels.projName')" name="title" :rules="nameValidationRules" class="my-10 mx-10">
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
