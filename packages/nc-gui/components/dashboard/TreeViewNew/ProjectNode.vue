<script lang="ts" setup>
import { Icon as IconifyIcon } from '@iconify/vue'
import { nextTick } from '@vue/runtime-core'
import { Dropdown, Tooltip, message } from 'ant-design-vue'
import type { ProjectType } from 'nocodb-sdk'
import { LoadingOutlined } from '@ant-design/icons-vue'
import { openLink, useProjects } from '#imports'
import { extractSdkResponseErrorMsg } from '~/utils'
import { ProjectInj, ProjectRoleInj, ToggleDialogInj } from '~/context'
import { NcProject } from '~~/lib'
const indicator = h(LoadingOutlined, {
  class: '!text-gray-400',
  style: {
    fontSize: '0.85rem',
  },
  spin: true,
})

const project = inject(ProjectInj)!

const projectsStore = useProjects()

const { updateProject, deleteProject, getProjectMetaInfo } = projectsStore

const { addNewLayout } = useDashboardStore()

const { appInfo } = useGlobal()

const { closeTab } = useTabs()

const editMode = ref(false)

const tempTitle = ref('')

const { t } = useI18n()

const input = ref<HTMLInputElement>()

const { isUIAllowed } = useUIPermission()

const projectRole = inject(ProjectRoleInj)

const toggleDialog = inject(ToggleDialogInj)

const { addNewPage } = useDocStore()

const { $e } = useNuxtApp()

const enableEditMode = () => {
  editMode.value = true
  tempTitle.value = project.value.title!
  nextTick(() => {
    input.value?.focus()
    input.value?.select()
    input.value?.scrollIntoView()
  })
}

const updateProjectTitle = async () => {
  try {
    await updateProject(project.value.id!, {
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
        await deleteProject(project.value.id!)
        await closeTab(project.value.id as any)
        message.success('Project deleted successfully')
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })
}

const { copy } = useCopy(true)

const copyProjectInfo = async () => {
  try {
    if (
      await copy(
        Object.entries(await getProjectMetaInfo(project.value.id!)!)
          .map(([k, v]) => `${k}: **${v}**`)
          .join('\n'),
      )
    ) {
      // Copied to clipboard
      message.info(t('msg.info.copiedToClipboard'))
    }
  } catch (e: any) {
    console.error(e)
    message.error(e.message)
  }
}

defineExpose({
  enableEditMode,
})

const setIcon = async (icon: string, project: ProjectType) => {
  try {
    const meta = {
      ...((project.meta as object) || {}),
      icon,
    }

    projectsStore.updateProject(project.id!, { meta: JSON.stringify(meta) })

    $e('a:project:icon:navdraw', { icon })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

function openTableCreateDialog() {
  $e('c:table:create:navdraw')

  const isOpen = ref(true)
  const baseId = project.value!.bases?.[0].id

  const { close } = useDialog(resolveComponent('DlgTableCreate'), {
    'modelValue': isOpen,
    'baseId': baseId, // || bases.value[0].id,
    'projectId': project.value!.id,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const addNewProjectChildEntity = () => {
  switch (project.value.type) {
    case NcProjectType.DASHBOARD:
      addNewLayout({ projectId: project.value!.id! })
      break
    case NcProjectType.DOCS:
      addNewPage({ parentPageId: undefined, projectId: project.value!.id! })
      break
    case NcProjectType.DB:
      openTableCreateDialog()
      break
  }
}

// todo: temp
const isSharedBase = ref(false)
</script>

<template>
  <div class="project-title-node group flex items-center w-full pl-2">
    <div class="nc-sidebar-expand">
      <PhTriangleFill
        class="invisible group-hover:visible cursor-pointer transform transition-transform duration-500 h-1.25 w-1.75 text-gray-500 rotate-90"
        :class="{ '!rotate-180': project.isExpanded }"
        @click.stop="project.isExpanded = !project.isExpanded"
      />
    </div>
    <component
      :is="isUIAllowed('projectIconCustomisation', false, projectRole) ? Dropdown : 'div'"
      trigger="click"
      destroy-popup-on-hide
      class="flex items-center mx-1"
      @click.stop
    >
      <div class="flex items-center select-none h-8" @click.stop>
        <a-spin
          v-if="project.isLoading"
          class="nc-sidebar-icon !flex !flex-row !items-center !my-0.5 !ml-1.5 !mr-1.5 w-8"
          :indicator="indicator"
        />
        <component :is="isUIAllowed('projectIconCustomisation', false, projectRole) ? Tooltip : 'div'" v-else>
          <span v-if="project.meta?.icon" :key="project.meta?.icon" class="nc-sidebar-icon flex items-center">
            <IconifyIcon
              :key="project.meta?.icon"
              :data-testid="`nc-icon-${project.meta?.icon}`"
              class="text-xl"
              :icon="project.meta?.icon"
            ></IconifyIcon>
          </span>

          <GeneralProjectIcon v-else :type="project.type" />

          <template v-if="isUIAllowed('projectIconCustomisation', false, projectRole)" #title>
            <span class="text-xs"> Change icon </span>
          </template>
        </component>
      </div>
      <template v-if="isUIAllowed('projectIconCustomisation', false, projectRole)" #overlay>
        <GeneralEmojiIcons class="shadow bg-white p-2" @select-icon="setIcon($event, project)" />
      </template>
    </component>

    <input
      v-if="editMode"
      ref="input"
      v-model="tempTitle"
      class="flex-grow min-w-5 leading-1 outline-0 ring-none"
      @click.stop
      @keyup.enter="updateProjectTitle"
      @keyup.esc="closeEditMode"
    />
    <span v-else class="capitalize min-w-5 text-ellipsis overflow-clip select-none">
      {{ project.title }}
    </span>
    <span :class="{ 'flex-grow': !editMode }"></span>

    <div
      class="flex flex-row pr-1 items-center gap-x-2 cursor-pointer hover:text-black text-gray-600 text-sm invisible !group-hover:visible"
      data-testid="nc-docs-sidebar-add-page"
      @click="addNewProjectChildEntity"
    >
      <MdiPlus />
    </div>

    <a-dropdown>
      <MdiDotsVertical class="mr-1.5 opacity-0 group-hover:opacity-100" @click.stop />
      <template #overlay>
        <a-menu>
          <!--          <a-menu class="!ml-1 !w-[300px] !text-sm"> -->
          <a-menu-item-group>
            <template #title>
              <div class="group select-none flex items-center gap-4 py-1">
                <GeneralIcon icon="folder" class="group-hover:text-accent text-xl" />

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
                  <GeneralIcon icon="copy" class="group-hover:text-accent" />
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
                  @click.stop="openLink(`/api/v1/db/meta/projects/${project.id}/swagger`, appInfo.ncSiteUrl)"
                >
                  <GeneralIcon icon="json" class="group-hover:text-accent" />
                  {{ $t('activity.account.swagger') }}
                </div>
              </a-menu-item>

              <a-menu-divider />

              <!-- Team & Settings -->
              <a-menu-item key="teamAndSettings">
                <div
                  v-if="isUIAllowed('settings')"
                  v-e="['c:navdraw:project-settings']"
                  class="nc-project-menu-item group"
                  @click="toggleDialog(true, 'teamAndAuth', undefined, project.id)"
                >
                  <GeneralIcon icon="settings" class="group-hover:text-accent" />
                  {{ $t('title.teamAndSettings') }}
                </div>
              </a-menu-item>

              <a-menu-divider />

              <a-menu-item @click="enableEditMode">
                <div class="nc-project-menu-item group">
                  <GeneralIcon icon="edit" />
                  Edit
                </div>
              </a-menu-item>
              <a-menu-item @click="confirmDeleteProject">
                <div class="nc-project-menu-item group">
                  <GeneralIcon icon="delete" />
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

<style lang="scss" scoped>
.nc-sidebar-icon {
  @apply ml-0.5 mr-1;
}
</style>
