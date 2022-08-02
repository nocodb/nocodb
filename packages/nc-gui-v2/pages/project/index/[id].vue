<script lang="ts" setup>
import { onMounted } from '@vue/runtime-core'
import type { Form } from 'ant-design-vue'
import type { ProjectType } from 'nocodb-sdk'
import { ref } from 'vue'
import { useToast } from 'vue-toastification'
import { navigateTo, useNuxtApp, useRoute } from '#app'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import { projectTitleValidator } from '~/utils/validation'
import MaterialSymbolsRocketLaunchOutline from '~icons/material-symbols/rocket-launch-outline'

const loading = ref(false)

const { $api, $state } = useNuxtApp()
const toast = useToast()
const route = useRoute()

const nameValidationRules = [
  {
    required: true,
    message: 'Project name is required',
  },
  projectTitleValidator,
]

const formState = reactive({
  title: '',
})

const getProject = async () => {
  try {
    const result: ProjectType = await $api.project.read(route.params.id as string)
    formState.title = result.title as string
  } catch (e: any) {
    toast.error(await extractSdkResponseErrorMsg(e))
  }
}
const renameProject = async () => {
  loading.value = true
  try {
    await $api.project.update(route.params.id as string, formState)

    navigateTo(`/nc/${route.params.id}`)
  } catch (e: any) {
    toast.error(await extractSdkResponseErrorMsg(e))
  }
  loading.value = false
}

const form = ref<typeof Form>()

// hide sidebar
$state.sidebarOpen.value = false

// select and focus title field on load
onMounted(async () => {
  await getProject()
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
    <h3 class="text-3xl text-center font-semibold mb-2">{{ $t('activity.editProject') }}</h3>

    <a-form ref="form" :model="formState" name="basic" layout="vertical" autocomplete="off" @finish="renameProject">
      <a-form-item :label="$t('labels.projName')" name="title" :rules="nameValidationRules" class="my-10 mx-10">
        <a-input v-model:value="formState.title" name="title" class="nc-metadb-project-name" />
      </a-form-item>

      <a-form-item style="text-align: center" class="mt-2">
        <a-button type="primary" html-type="submit" class="mx-auto flex justify-self-center">
          <MaterialSymbolsRocketLaunchOutline class="mr-1" />
          <span> {{ $t('general.edit') }} </span></a-button
        >
      </a-form-item>
    </a-form>
  </a-card>
</template>
