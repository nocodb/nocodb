<script lang="ts" setup>
import { Icon as IconifyIcon } from '@iconify/vue'
import { nextTick } from '@vue/runtime-core'
import { Dropdown, Tooltip, message } from 'ant-design-vue'
import type { ProjectType } from 'nocodb-sdk'
import { openLink, useProjects } from '#imports'
import { extractSdkResponseErrorMsg } from '~/utils'
import { ProjectInj, ProjectRoleInj, ToggleDialogInj } from '~/context'

const project = inject(ProjectInj, ref({}))!

const projectsStore = useProjects()

const { updateProject, deleteProject, getProjectMetaInfo } = projectsStore

const { appInfo } = useGlobal()

const { closeTab } = useTabs()

const editMode = ref(false)

const tempTitle = ref('')

const { t } = useI18n()

const input = ref<HTMLInputElement>()

const { isUIAllowed } = useUIPermission()

const projectRole = inject(ProjectRoleInj)

const toggleDialog = inject(ToggleDialogInj)

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
        await closeTab(project.value.id!)
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
  } catch (e) {
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
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

// todo: temp
const isSharedBase = ref(false)
</script>

<template>
  <div class="project-title-node group flex items-center w-full px-0.5 py-0.5">
    <!--    <GeneralProjectIcon class="mx-2" :type="project.type" /> -->

    <component
      :is="isUIAllowed('projectIconCustomisation', false, projectRole) ? Dropdown : 'div'"
      trigger="click"
      destroy-popup-on-hide
      class="flex items-center mx-2"
      @click.stop
    >
      <div class="flex items-center" @click.stop>
        <component :is="isUIAllowed('projectIconCustomisation', false, projectRole) ? Tooltip : 'div'">
          <span v-if="project.meta?.icon" :key="project.meta?.icon" class="nc-table-icon flex items-center">
            <IconifyIcon
              :key="project.meta?.icon"
              :data-testid="`nc-icon-${project.meta?.icon}`"
              class="text-xl"
              :icon="project.meta?.icon"
            ></IconifyIcon>
          </span>

          <GeneralProjectIcon v-else :type="project.type" />

          <template v-if="isUIAllowed('projectIconCustomisation', false, projectRole)" #title>Change icon</template>
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
    <span v-else class="capitalize min-w-5 text-ellipsis overflow-clip">
      {{ project.title }}
    </span>
    <span :class="{ 'flex-grow': !editMode }"></span>
    <a-dropdown>
      <GeneralIcon icon="threeDotVertical" class="mr-1.5 opacity-0 group-hover:opacity-100" @click.stop />
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
