<script lang="ts" setup>
import { customAlphabet } from 'nanoid'
import type { Form, Input } from 'ant-design-vue'
import type { RuleObject } from 'ant-design-vue/es/form'
import type { VNodeRef } from '@vue/runtime-core'
import type { ProjectType } from 'nocodb-sdk'
import tinycolor from 'tinycolor2'
import {
  extractSdkResponseErrorMsg,
  generateUniqueName,
  message,
  navigateTo,
  nextTick,
  onMounted,
  projectTitleValidator,
  reactive,
  ref,
  useApi,
  useCommandPalette,
  useNuxtApp,
  useProject,
  useRoute,
  useSidebar,
  useTable,
} from '#imports'
import { NcProjectType } from '~/utils'

const { $e } = useNuxtApp()

const { loadTables, loadProject } = useProject()

const { table, createTable } = useTable(async (_) => {
  await loadTables()
})

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

    // todo: provide proper project type
    creating.value = true

    const result = (await api.project.create({
      title: formState.title,
      fk_workspace_id: route.query.workspaceId,
      type: route.query.type ?? NcProjectType.DB,
      color,
      meta: JSON.stringify({
        theme: {
          primaryColor: color,
          accentColor: complement.toHex8String(),
        },
        ...(route.query.type === NcProjectType.COWRITER && { prompt_statement: '' }),
      }),
    }) as Partial<ProjectType>

    refreshCommandPalette()

    switch (route.query.type) {
      case NcProjectType.DOCS:
        await loadProject(true, result.id)
        await navigateTo(`/ws/${route.query.workspaceId}/nc/${result.id}/doc/p/${result.id}`)
        // todo: Hack. Remove
        setTimeout(() => {
          window.location.reload()
        }, 10)
        break
      case NcProjectType.COWRITER: {
        // force load project so that baseId is available in useTable
        await loadProject(true, result.id)
        // Create a table for the COWRITER form
        const nanoidV2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14)
        table.table_name = `nc_cowriter_${nanoidV2()}`
        // exclude title
        table.columns = ['id', 'created_at', 'updated_at']
        await createTable()

        await navigateTo(`/nc/cowriter/${result.id}`)
        break
      }
      default:
        await navigateTo(`/ws/${route.query.workspaceId}/nc/${result.id}`)

    }
  } catch (e: any) {
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
          <MdiChevronLeft class="text-black group-hover:(text-accent scale-110)" />
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
