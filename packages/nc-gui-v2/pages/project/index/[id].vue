<script lang="ts" setup>
import type { Form } from 'ant-design-vue'
import type { ProjectType } from 'nocodb-sdk'
import { message } from 'ant-design-vue'
import {
  extractSdkResponseErrorMsg,
  navigateTo,
  nextTick,
  onMounted,
  projectTitleValidator,
  reactive,
  ref,
  useApi,
  useRoute,
  useSidebar,
} from '#imports'

const { api, isLoading } = useApi()

useSidebar({ hasSidebar: false })

const route = useRoute()

const nameValidationRules = [
  {
    required: true,
    message: 'Project name is required',
  },
  projectTitleValidator,
]

const form = ref<typeof Form>()

const formState = reactive({
  title: '',
})

const getProject = async () => {
  try {
    const result: ProjectType = await api.project.read(route.params.id as string)
    formState.title = result.title as string
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const renameProject = async () => {
  try {
    await api.project.update(route.params.id as string, formState)

    navigateTo(`/nc/${route.params.id}`)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

// select and focus title field on load
onMounted(async () => {
  await getProject()

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
  <div
    class="overflow-auto md:bg-primary bg-opacity-5 pb-4 update-project h-full min-h-[600px] flex flex-col justify-center items-end"
  >
    <div
      class="bg-white mt-65px relative flex flex-col justify-center gap-2 w-full max-w-[500px] !mx-auto p-8 md:(rounded-lg border-1 border-gray-200 shadow-xl)"
    >
      <general-noco-icon class="color-transition hover:(ring ring-accent)" :class="[isLoading ? 'animated-bg-gradient' : '']" />

      <h1 class="prose-2xl font-bold self-center my-4">{{ $t('activity.editProject') }}</h1>

      <a-form ref="form" :model="formState" name="basic" layout="vertical" no-style autocomplete="off" @finish="renameProject">
        <a-form-item :label="$t('labels.projName')" name="title" :rules="nameValidationRules">
          <a-input v-model:value="formState.title" name="title" class="nc-metadb-project-name" />
        </a-form-item>

        <div class="text-center">
          <button type="submit" class="submit">
            <span class="flex items-center gap-2">
              <MaterialSymbolsRocketLaunchOutline />
              {{ $t('general.edit') }}
            </span>
          </button>
        </div>
      </a-form>
    </div>
  </div>
</template>

<style lang="scss">
.update-project {
  .ant-input-affix-wrapper,
  .ant-input {
    @apply !appearance-none my-1 border-1 border-solid border-primary/50 rounded;
  }

  .password {
    input {
      @apply !border-none;
    }
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
