<script lang="ts" setup>
import { onMounted } from '@vue/runtime-core'
import type { Form } from 'ant-design-vue'
import { notification } from 'ant-design-vue'
import { nextTick, reactive, ref, useApi, useSidebar } from '#imports'
import { navigateTo, useNuxtApp } from '#app'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import { projectTitleValidator } from '~/utils/validation'
import MaterialSymbolsRocketLaunchOutline from '~icons/material-symbols/rocket-launch-outline'

const { $e } = useNuxtApp()

const { api, isLoading } = useApi()

useSidebar({ hasSidebar: false })

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

const createProject = async () => {
  $e('a:project:create:xcdb')
  try {
    const result = await api.project.create({
      title: formState.title,
    })

    await navigateTo(`/nc/${result.id}`)
  } catch (e: any) {
    notification.error({
      message: await extractSdkResponseErrorMsg(e),
    })
  }
}

const form = ref<typeof Form>()

// select and focus title field on load
onMounted(async () => {
  await nextTick(() => {
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
  <a-card :loading="isLoading" class="w-[500px] mx-auto !mt-100px shadow-md">
    <GeneralNocoIcon />

    <h3 class="text-3xl text-center font-semibold mt-8 mb-2">{{ $t('activity.createProject') }}</h3>

    <a-form ref="form" :model="formState" name="basic" layout="vertical" autocomplete="off" @finish="createProject">
      <a-form-item :label="$t('labels.projName')" name="title" :rules="nameValidationRules" class="my-10 mx-10">
        <a-input v-model:value="formState.title" name="title" class="nc-metadb-project-name" />
      </a-form-item>

      <a-form-item style="text-align: center" class="mt-2">
        <a-button type="primary" html-type="submit">
          <div class="flex items-center">
            <MaterialSymbolsRocketLaunchOutline class="mr-1" />
            {{ $t('general.create') }}
          </div>
        </a-button>
      </a-form-item>
    </a-form>
  </a-card>
</template>
