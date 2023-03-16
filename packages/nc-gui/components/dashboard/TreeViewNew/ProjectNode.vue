<script lang="ts" setup>
import type { ProjectType } from 'nocodb-sdk'
import { nextTick } from '@vue/runtime-core'
import { useProjects } from '#imports'
import { extractSdkResponseErrorMsg } from '~/utils'

const props = defineProps<{
  project: ProjectType
}>()

const projectStore = useProjects()

const { updateProject, deleteProject } = projectStore

const editMode = ref(false)

const tempTitle = ref('')

const input = ref<HTMLInputElement>()

const { isUIAllowed } = useUIPermission()

const enableEditMode = () => {
  editMode.value = true
  tempTitle.value = props.project.title!
  nextTick(() => {
    input.value?.focus()
    input.value?.select()
    input.value?.scrollIntoView()
  })
}

const updateProjectTitle = async () => {
  try {
    await updateProject(props.project.id!, {
      title: tempTitle.value,
    })
    editMode.value = false
    tempTitle.value = ''
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const closeEditMode = () => {
  editMode.value = false
  tempTitle.value = ''
}


const confirmDeleteProject = () => {
  Modal.confirm({
    title: 'Delete Project',
    content: 'Are you sure you want to delete this project?',
    onOk: async () => {
      try {
        await deleteProject(props.project.id!)
        message.success('Project deleted successfully')
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })
}

defineExpose({
  enableEditMode,
})

// todo: temp
const isSharedBase = ref(false)
</script>

<template>
  <div class="project-title-node group flex items-center">
    <GeneralProjectIcon class="mx-2" :type="project.type" />

    <input
      v-if="editMode"
      ref="input"
      v-model="tempTitle"
      class="flex-grow min-w-5 leading-1 outline-0 ring-none"
      @click.stop
      @keyup.enter="updateProjectTitle"
      @keyup.esc="closeEditMode"
    />
    <span v-else class="capitalize min-w-5 text-ellipsis overflow-clip">
      {{ project.title }}
    </span>
    <span :class="{ 'flex-grow': !editMode }"></span>
    <a-dropdown>
      <MdiDotsHorizontal class="mr-2 opacity-0 group-hover:opacity-100" @click.stop />
      <template #overlay>
        <a-menu>


          <!--          <a-menu class="!ml-1 !w-[300px] !text-sm"> -->
          <a-menu-item-group>
            <template #title>
              <div class="group select-none flex items-center gap-4 py-1">
                <MdiFolder class="group-hover:text-accent text-xl" />

                <div class="flex flex-col">
                  <div class="text-lg group-hover:(!text-primary) font-semibold capitalize">
                    <GeneralTruncateText>{{ project.title }}</GeneralTruncateText>
                  </div>

                  <div v-if="!isSharedBase" class="flex items-center gap-1">
                    <div class="group-hover:(!text-primary)">ID:</div>

                    <div class="text-xs group-hover:text-accent truncate font-italic">{{ project.id }}</div>
                  </div>
                </div>
              </div>
            </template>
            <template v-if="!isSharedBase">
              <!-- Copy Project Info -->
              <a-menu-item key="copy">
                <div v-e="['c:navbar:user:copy-proj-info']" class="nc-project-menu-item group" @click.stop="copyProjectInfo">
                  <MdiContentCopy class="group-hover:text-accent" />
                  {{ $t('activity.account.projInfo') }}
                </div>
              </a-menu-item>

              <a-menu-divider />

              <!-- Swagger: Rest APIs -->
              <a-menu-item key="api">
                <div
                  v-if="isUIAllowed('apiDocs')"
                  v-e="['e:api-docs']"
                  class="nc-project-menu-item group"
                  @click.stop="openLink(`/api/v1/db/meta/projects/${route.params.projectId}/swagger`, appInfo.ncSiteUrl)"
                >
                  <MdiApi class="group-hover:text-accent" />
                  {{ $t('activity.account.swagger') }}
                </div>
              </a-menu-item>

              <!-- Copy Auth Token -->
              <a-menu-item key="copy">
                <div v-e="['a:navbar:user:copy-auth-token']" class="nc-project-menu-item group" @click.stop="copyAuthToken">
                  <MdiScriptTextKeyOutline class="group-hover:text-accent" />
                  {{ $t('activity.account.authToken') }}
                </div>
              </a-menu-item>

              <a-menu-divider />

              <!-- Team & Settings -->
              <a-menu-item key="teamAndSettings">
                <div
                  v-if="isUIAllowed('settings')"
                  v-e="['c:navdraw:project-settings']"
                  class="nc-project-menu-item group"
                  @click="toggleDialog(true, 'teamAndAuth')"
                >
                  <MdiCog class="group-hover:text-accent" />
                  {{ $t('title.teamAndSettings') }}
                </div>
              </a-menu-item>

              <!-- Theme -->
              <template v-if="isUIAllowed('projectTheme')">
                <a-sub-menu key="theme">
                  <template #title>
                    <div class="nc-project-menu-item group">
                      <ClarityImageLine class="group-hover:text-accent" />
                      {{ $t('activity.account.themes') }}

                      <div class="flex-1" />

                      <MaterialSymbolsChevronRightRounded
                        class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                      />
                    </div>
                  </template>

                  <template #expandIcon></template>

                  <LazyGeneralColorPicker
                    :model-value="theme.primaryColor"
                    :colors="projectThemeColors"
                    :row-size="9"
                    :advanced="false"
                    class="rounded-t"
                    @input="handleThemeColor('swatch', $event)"
                  />

                  <!-- Custom Theme -->
                  <a-sub-menu key="theme-2">
                    <template #title>
                      <div class="nc-project-menu-item group">
                        {{ $t('labels.customTheme') }}

                        <div class="flex-1" />

                        <MaterialSymbolsChevronRightRounded
                          class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                        />
                      </div>
                    </template>

                    <!-- Primary Color -->
                    <template #expandIcon></template>

                    <a-sub-menu key="pick-primary">
                      <template #title>
                        <div class="nc-project-menu-item group">
                          <ClarityColorPickerSolid class="group-hover:text-accent" />
                          {{ $t('labels.primaryColor') }}
                        </div>
                      </template>

                      <template #expandIcon></template>

                      <LazyGeneralChromeWrapper @input="handleThemeColor('primary', $event)" />
                    </a-sub-menu>

                    <!-- Accent Color -->
                    <a-sub-menu key="pick-accent">
                      <template #title>
                        <div class="nc-project-menu-item group">
                          <ClarityColorPickerSolid class="group-hover:text-accent" />
                          {{ $t('labels.accentColor') }}
                        </div>
                      </template>

                      <template #expandIcon></template>

                      <LazyGeneralChromeWrapper @input="handleThemeColor('accent', $event)" />
                    </a-sub-menu>
                  </a-sub-menu>
                </a-sub-menu>
              </template>

              <a-menu-divider />

              <a-menu-item @click="enableEditMode">
                <div
                  class="nc-project-menu-item group">
                  <MdiPencilOutline />
                  Edit
                </div>
              </a-menu-item>
              <a-menu-item @click="confirmDeleteProject">
                <div
                  class="nc-project-menu-item group">
                  <MdiDeleteOutline />
                  Delete
                </div>
              </a-menu-item>
            </template>
          </a-menu-item-group>
          <!--          </a-menu> -->
        </a-menu>
      </template>
    </a-dropdown>
  </div>
</template>
