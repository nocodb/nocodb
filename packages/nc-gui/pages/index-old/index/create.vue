<script lang="ts" setup>
import type { Form, Input } from 'ant-design-vue'
import type { RuleObject } from 'ant-design-vue/es/form'
import type { VNodeRef } from '@vue/runtime-core'
import type { ProjectType } from 'nocodb-sdk'
import tinycolor from 'tinycolor2'
import {
  NcProjectType,
  extractSdkResponseErrorMsg,
  generateUniqueName,
  iconMap,
  message,
  navigateTo,
  nextTick,
  onMounted,
  projectTitleValidator,
  reactive,
  ref,
  useApi,
  useCommandPalette,
  useGlobal,
  useNuxtApp,
  useProject,
  useRoute,
  useSidebar,
  useTable,
} from '#imports'

const { $e } = useNuxtApp()

useProjects()
const { loadTables } = useProject()

useTable(async (_) => {
  await loadTables()
})

const { navigateToProject } = useGlobal()

const { refreshCommandPalette } = useCommandPalette()

const { api, isLoading } = useApi({ useGlobalInstance: true })

useSidebar('nc-left-sidebar', { hasSidebar: false })

const nameValidationRules = [
  {
    required: true,
    message: 'Project name is required',
  },
  projectTitleValidator,
] as RuleObject[]

const form = ref<typeof Form>()

const formState = reactive({
  title: '',
})

const route = useRoute()
const creating = ref(false)

const createProject = async () => {
  $e('a:project:create:xcdb')
  try {
    // pick a random color from array and assign to project
    const color = projectThemeColors[Math.floor(Math.random() * 1000) % projectThemeColors.length]
    const tcolor = tinycolor(color)

    const complement = tcolor.complement()

    const { getBaseUrl } = useGlobal()

    // todo: provide proper project type
    creating.value = true

    const result = (await api.project.create(
      {
        title: formState.title,
        color,
        meta: JSON.stringify({
          theme: {
            primaryColor: color,
            accentColor: complement.toHex8String(),
          },
        }),
      },
      {
        baseURL: getBaseUrl(route.query.workspaceId as string),
      },
    )) as Partial<ProjectType>

    refreshCommandPalette()

    navigateToProject({
      projectId: result.id!,
      workspaceId: route.query.workspaceId as string,
      type: NcProjectType.DB,
    })
  } catch (e: any) {
    console.error(e)
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    creating.value = false
  }
}

const input: VNodeRef = ref<typeof Input>()

onMounted(async () => {
  formState.title = await generateUniqueName()
  await nextTick()
  input.value?.$el?.focus()
  input.value?.$el?.select()
})
</script>

<template>
  <NuxtLayout name="new">
    <div class="mt-20">
      <div
        class="min-w-2/4 xl:max-w-2/4 w-full mx-auto create relative flex flex-col justify-center gap-2 w-full p-8 md:(bg-white rounded-lg border-1 border-gray-200 shadow)"
      >
        <LazyGeneralNocoIcon class="color-transition hover:(ring ring-accent)" :animate="isLoading" />

        <div
          class="color-transition transform group absolute top-5 left-5 text-4xl rounded-full cursor-pointer"
          @click="navigateTo('/')"
        >
          <component :is="iconMap.chevronLeft" class="text-black group-hover:(text-accent scale-110)" />
        </div>

        <h1 class="prose-2xl font-bold self-center my-4">{{ $t('activity.createProject') }}</h1>

        <a-form
          ref="form"
          :model="formState"
          name="basic"
          layout="vertical"
          class="lg:max-w-3/4 w-full !mx-auto"
          no-style
          autocomplete="off"
          @finish="createProject"
        >
          <a-form-item :label="$t('labels.projName')" name="title" :rules="nameValidationRules" class="m-10">
            <a-input ref="input" v-model:value="formState.title" name="title" class="nc-metadb-project-name" />
          </a-form-item>

          <div class="text-center">
            <a-spin v-if="creating" spinning />
            <button v-else class="scaling-btn bg-opacity-100" type="submit">
              <span class="flex items-center gap-2">
                <MaterialSymbolsRocketLaunchOutline />
                {{ $t('general.create') }}
              </span>
            </button>
          </div>
        </a-form>
      </div>
    </div>
  </NuxtLayout>
</template>

<style lang="scss">
.create {
  .ant-input-affix-wrapper,
  .ant-input {
    @apply !appearance-none my-1 border-1 border-solid border-primary border-opacity-50 rounded;
  }
}
</style>
