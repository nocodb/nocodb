<script lang="ts" setup>
import type { Form } from 'ant-design-vue'
import type { ProjectType } from 'nocodb-sdk'
import {
  extractSdkResponseErrorMsg,
  message,
  navigateTo,
  nextTick,
  onMounted,
  projectTitleValidator,
  reactive,
  ref,
  useProject,
  useRoute,
  useSidebar,
} from '#imports'

useSidebar('nc-left-sidebar', { hasSidebar: false })

const route = useRoute()

const { project, loadProject, updateProject, isLoading } = useProject(route.params.projectId as string)

await loadProject()

const nameValidationRules = [
  {
    required: true,
    message: 'Project name is required',
  },
  projectTitleValidator,
]

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

// select and focus title field on load
onMounted(async () => {
  formState.title = project.value.title as string

  await nextTick(() => {
    // todo: replace setTimeout and follow better approach
    setTimeout(() => {
      const input = form.value?.$el?.querySelector('input[type=text]')

      input.setSelectionRange(0, formState.title?.length)

      input.focus()
    }, 500)
  })
})
</script>

<template>
  <div
    class="update-project bg-white relative flex-auto flex flex-col justify-center gap-2 p-8 md:(rounded-lg border-1 border-gray-200 shadow-xl)"
  >
    <LazyGeneralNocoIcon class="color-transition hover:(ring ring-accent)" :class="[isLoading ? 'animated-bg-gradient' : '']" />

    <div
      class="color-transition transform group absolute top-5 left-5 text-4xl rounded-full bg-white cursor-pointer"
      @click="navigateTo('/')"
    >
      <MdiChevronLeft class="text-black group-hover:(text-accent scale-110)" />
    </div>

    <h1 class="prose-2xl font-bold self-center my-4">{{ $t('activity.editProject') }}</h1>

    <a-form
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
        <a-input v-model:value="formState.title" name="title" class="nc-metadb-project-name" />
      </a-form-item>

      <div class="text-center">
        <button v-e="['a:project:edit:rename']" type="submit" class="submit">
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
    @apply !appearance-none my-1 border-1 border-solid rounded;
  }

  .submit {
    @apply z-1 relative color-transition rounded p-3 text-white shadow-sm;

    &::after {
      @apply rounded absolute top-0 left-0 right-0 bottom-0 transition-all duration-150 ease-in-out bg-primary;
      content: '';
      z-index: -1;
    }

    &:hover::after {
      @apply transform scale-110 ring ring-accent;
    }

    &:active::after {
      @apply ring ring-accent;
    }
  }
}
</style>
