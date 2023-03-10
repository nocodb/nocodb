<script lang="ts" setup>
import type { Form } from 'ant-design-vue'
import type { ProjectType } from 'nocodb-sdk'
import type { VNodeRef } from '@vue/runtime-core'
import type { RuleObject } from 'ant-design-vue/es/form'
import {
  extractSdkResponseErrorMsg,
  message,
  navigateTo,
  projectTitleValidator,
  reactive,
  ref,
  storeToRefs,
  useProject,
  useRoute,
} from '#imports'

const route = useRoute()

const projectStore = useProject()

const { loadProject, updateProject } = projectStore
const { project, isLoading } = storeToRefs(projectStore)

const nameValidationRules = [
  {
    required: true,
    message: 'Project name is required',
  },
  projectTitleValidator,
] as RuleObject[]

const form = ref<typeof Form>()

const formState = reactive<Partial<ProjectType>>({
  title: '',
})

const renameProject = async () => {
  try {
    await updateProject(formState)

    navigateTo(`/nc/${route.params.projectId}`)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

onBeforeMount(async () => {
  await loadProject(false)

  formState.title = project.value?.title
})

const focus: VNodeRef = (el) => (el as HTMLInputElement)?.focus()
</script>

<template>
  <div
    class="update-project relative flex-auto flex flex-col justify-center gap-2 p-8 md:(bg-white rounded-lg border-1 border-gray-200 shadow)"
  >
    <LazyGeneralNocoIcon class="color-transition hover:(ring ring-accent)" :animate="isLoading" />

    <div
      class="color-transition transform group absolute top-5 left-5 text-4xl rounded-full cursor-pointer"
      @click="navigateTo('/')"
    >
      <MdiChevronLeft class="text-black group-hover:(text-accent scale-110)" />
    </div>

    <h1 class="prose-2xl font-bold self-center my-4">{{ $t('activity.editProject') }}</h1>

    <a-skeleton v-if="isLoading" />

    <a-form
      v-else
      ref="form"
      :model="formState"
      name="basic"
      layout="vertical"
      class="lg:max-w-3/4 w-full !mx-auto"
      no-style
      autocomplete="off"
      @finish="renameProject"
    >
      <a-form-item :label="$t('labels.projName')" name="title" :rules="nameValidationRules">
        <a-input :ref="focus" v-model:value="formState.title" name="title" class="nc-metadb-project-name" />
      </a-form-item>

      <div class="text-center">
        <button v-e="['a:project:edit:rename']" type="submit" class="scaling-btn bg-opacity-100">
          <span class="flex items-center gap-2">
            <MaterialSymbolsRocketLaunchOutline />
            {{ $t('general.edit') }}
          </span>
        </button>
      </div>
    </a-form>
  </div>
</template>

<style lang="scss" scoped>
.update-project {
  .ant-input-affix-wrapper,
  .ant-input {
    @apply !appearance-none my-1 border-1 border-solid border-primary border-opacity-50 rounded;
  }
}
</style>
