<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import type { WorkspaceType } from 'nocodb-sdk'
import { useDebounceFn } from '@vueuse/core'
import tinycolor from 'tinycolor2'
import { onMounted, projectThemeColors, ref, useWorkspace } from '#imports'
import { navigateTo } from '#app'

const props = defineProps<{
  isOpen: boolean
}>()

const workspaceStore = useWorkspace()

const { saveTheme } = workspaceStore
const { activeWorkspace, workspacesList, isWorkspaceOwner, collaborators } = storeToRefs(workspaceStore)
const { loadWorkspaces, clearWorkspaces } = workspaceStore

const { navigateToTable } = useTablesStore()

const { signOut, signedIn, user, token } = useGlobal()

const { appInfo } = useGlobal()

const { copy } = useCopy(true)

const email = computed(() => user.value?.email ?? '---')

const { isUIAllowed } = useUIPermission()

const { theme, defaultTheme } = useTheme()

const workspaceModalVisible = ref(false)
const isWorkspaceDropdownOpen = ref(false)
const isAuthTokenCopied = ref(false)

const createDlg = ref(false)

const otherWorkspaces = computed(() => {
  return workspacesList.value.filter((ws) => ws.id !== activeWorkspace.value?.id)
})

const onWorkspaceCreate = async (workspace: WorkspaceType) => {
  createDlg.value = false
  await loadWorkspaces()

  // TODO: Add to swagger
  const project = (workspace as any).projects?.[0]
  const table = project?.tables?.[0]

  if (project && table) {
    return await navigateToTable({
      projectId: project.id,
      tableId: table.id,
      workspaceId: workspace.id,
    })
  }

  navigateTo(`/${workspace.id}`)
}

const updateWorkspaceTitle = useDebounceFn(async () => {
  if (!activeWorkspace.value || !activeWorkspace.value.id) return
  await workspaceStore.updateWorkspace(activeWorkspace.value.id, {
    title: activeWorkspace.value.title,
  })
}, 500)

const handleThemeColor = async (mode: 'swatch' | 'primary' | 'accent', color?: string) => {
  switch (mode) {
    case 'swatch': {
      if (color === defaultTheme.primaryColor) {
        return await saveTheme(defaultTheme)
      }

      const tcolor = tinycolor(color)
      if (tcolor.isValid()) {
        const complement = tcolor.complement()

        await saveTheme({
          primaryColor: color,
          accentColor: complement.toHex8String(),
        })
      }
      break
    }
    case 'primary': {
      const tcolor = tinycolor(color)

      if (tcolor.isValid()) {
        await saveTheme({
          primaryColor: color,
        })
      }
      break
    }
    case 'accent': {
      const tcolor = tinycolor(color)

      if (tcolor.isValid()) {
        await saveTheme({
          accentColor: color,
        })
      }
      break
    }
  }
}

const logout = async () => {
  clearWorkspaces()
  await signOut()
  navigateTo('/signin')
}

const projectStore = useProject()

const { isSharedBase } = storeToRefs(projectStore)

// todo: temp
const modalVisible = false

const copyAuthToken = async () => {
  try {
    await copy(token.value!)
    isAuthTokenCopied.value = true
  } catch (e: any) {
    console.error(e)
    message.error(e.message)
  }
}

onKeyStroke('Escape', () => {
  if (isWorkspaceDropdownOpen.value) {
    isWorkspaceDropdownOpen.value = false
  }
})

const switchWorkspace = async (workspaceId: string) => {
  navigateTo(`/${workspaceId}`)
}

const getWorkspaceColor = (workspace: WorkspaceType) => workspace.meta?.color || stringToColour(workspace.id!)
</script>

<template>
  <NcDropdown
    v-model:visible="isWorkspaceDropdownOpen"
    class="h-full min-w-0"
    :trigger="['click']"
    placement="bottom"
    overlay-class-name="nc-dropdown-workspace-menu"
  >
    <div
      :style="{ width: props.isOpen ? 'calc(100% - 40px) pr-2' : '100%' }"
      :class="[props.isOpen ? '' : 'justify-center']"
      data-testid="nc-workspace-menu"
      class="group cursor-pointer flex flex-grow w-full gap-x-2 items-center nc-workspace-menu overflow-hidden py-1.25 pr-0.25"
    >
      <slot name="brandIcon" />
      <template v-if="props.isOpen">
        <div v-if="activeWorkspace" class="flex min-w-10 font-semibold text-base max-w-82/100">
          <div class="text-md truncate capitalize">{{ activeWorkspace.title }}</div>
        </div>

        <GeneralIcon icon="arrowDown" class="min-w-6 text-lg !text-gray-700" />
        <div class="flex flex-grow"></div>
      </template>

      <template v-else>
        <MdiFolder class="text-primary cursor-pointer transform hover:scale-105 text-2xl" />
      </template>
    </div>

    <template #overlay>
      <a-menu class="" @click="isWorkspaceDropdownOpen = false">
        <a-menu-item-group class="!border-t-0">
          <!--  <div class="nc-menu-sub-head">Current Workspace</div> -->

          <div class="flex gap-2 min-w-0 p-4 items-start">
            <GeneralWorkspaceIcon :workspace="activeWorkspace" />
            <div class="flex flex-col gap-y-2.5">
              <div class="mt-0.5 flex capitalize mb-0 nc-workspace-title truncate min-w-10 text-black font-medium">
                {{ activeWorkspace?.title }}
              </div>
              <div class="flex flex-row items-center gap-x-2 -ml-0.1">
                <NcBadge class="flex text-gray-700">Free plan</NcBadge>
                <div class="flex text-xs text-gray-600">
                  {{ collaborators?.length }} {{ Number(collaborators?.length) > 1 ? 'members' : 'member' }}
                </div>
              </div>
            </div>
          </div>

          <a-menu-divider />

          <div class="max-h-300px nc-scrollbar-md !overflow-y-auto">
            <a-menu-item v-for="workspace of otherWorkspaces" :key="workspace.id!" @click="switchWorkspace(workspace.id!)">
              <div class="nc-workspace-menu-item group capitalize max-w-300px flex" data-testid="nc-workspace-list">
                <GeneralWorkspaceIcon :workspace="workspace" hide-label size="small" />
                <div class="mt-0.5 flex capitalize mb-0 nc-workspace-title truncate min-w-10">
                  {{ workspace?.title }}
                </div>
              </div>
            </a-menu-item>
          </div>
          <a-menu-item @click="createDlg = true">
            <div class="nc-workspace-menu-item group">
              <GeneralIcon icon="plusSquare" class="!text-inherit" />

              <div class="">Create New Workspace</div>
            </div>
          </a-menu-item>

          <!-- <a-menu-item @click="workspaceModalVisible = true">
              <div class="nc-workspace-menu-item group">
                <GeneralIcon icon="users" />
                Collaborators
              </div>
            </a-menu-item> -->

          <!-- Copy Auth Token -->
          <!-- <template v-if="!isSharedBase">
            <a-menu-item key="copy">
              <div
                v-e="['a:navbar:user:copy-auth-token']"
                class="nc-workspace-menu-item group !gap-x-3"
                @click.stop="copyAuthToken"
              >
                <GeneralIcon v-if="isAuthTokenCopied" icon="check" class="group-hover:text-black" />
                <GeneralIcon v-else icon="copy" class="group-hover:text-black" />
                <div v-if="isAuthTokenCopied">
                  {{ $t('activity.account.authTokenCopied') }}
                </div>
                <div v-else>
                  {{ $t('activity.account.authToken') }}
                </div>
              </div>
            </a-menu-item>
          </template> -->
          <!-- Language -->
          <a-sub-menu
            v-if="!appInfo.ee"
            key="language"
            class="lang-menu !py-0"
            popup-class-name="scrollbar-thin-dull min-w-50 max-h-90vh !overflow-auto"
          >
            <template #title>
              <div class="nc-workspace-menu-item group">
                <GeneralIcon icon="translate" class="group-hover:text-black nc-language" />
                {{ $t('labels.language') }}
                <div class="flex items-center text-gray-400 text-xs">(Community Translated)</div>
                <div class="flex-1" />

                <MaterialSymbolsChevronRightRounded class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400" />
              </div>
            </template>

            <template #expandIcon></template>

            <LazyGeneralLanguageMenu />
          </a-sub-menu>

          <!-- Account -->
          <!-- <template v-if="signedIn && !isSharedBase">
            <a-sub-menu key="account">
              <template #title>
                <div class="nc-workspace-menu-item group">
                  <GeneralIcon icon="account" class="group-hover:text-accent" />
                  {{ $t('labels.account') }}
                  <div class="flex-1" />

                  <MaterialSymbolsChevronRightRounded
                    class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                  />
                </div>
              </template>

              <template #expandIcon></template>

              <a-menu-item key="0" class="!rounded-t">
                <nuxt-link v-e="['c:navbar:user:email']" class="nc-workspace-menu-item group !no-underline" to="/account/users">
                  <GeneralIcon icon="at" class="mt-1 group-hover:text-accent" />&nbsp;
                  <div class="prose-sm group-hover:text-primary">
                    <div>Account</div>
                    <div class="text-xs text-gray-500">{{ email }}</div>
                  </div>
                </nuxt-link>
              </a-menu-item>

              <a-menu-item key="1" class="!rounded-b">
                <div v-e="['a:navbar:user:sign-out']" class="nc-workspace-menu-item group" @click="logout">
                  <GeneralIcon icon="signout" class="group-hover:(!text-accent)" />&nbsp;

                  <span class="prose-sm nc-user-menu-signout">
                    {{ $t('general.signOut') }}
                  </span>
                </div>
              </a-menu-item>
            </a-sub-menu>
          </template> -->
        </a-menu-item-group>
      </a-menu>
    </template>
  </NcDropdown>
  <GeneralModal v-model:visible="workspaceModalVisible" :class="{ active: modalVisible }" width="80%" :footer="null">
    <div class="relative flex flex-col px-6 py-2">
      <div class="absolute right-4 top-4 z-20">
        <a-button type="text" class="!p-1 !h-7 !rounded" @click="workspaceModalVisible = false">
          <component :is="iconMap.close" />
        </a-button>
      </div>
      <a-tabs v-model:activeKey="tab">
        <template v-if="isWorkspaceOwner">
          <a-tab-pane key="collab" tab="Collaborators" class="w-full">
            <WorkspaceCollaboratorsList class="h-full" />
          </a-tab-pane>
          <!-- <a-tab-pane key="settings" tab="Settings" class="w-full">
              <div class="min-h-50 flex items-center justify-center">Not available</div>
            </a-tab-pane> -->
        </template>
      </a-tabs>
    </div>
  </GeneralModal>

  <WorkspaceCreateDlg v-model="createDlg" @success="onWorkspaceCreate" />
</template>

<style scoped lang="scss">
.nc-workspace-title-input {
  @apply flex-grow py-2 px-3 outline-none hover:(bg-gray-50) focus:(bg-gray-50) font-medium rounded text-md text-defaault;
}

.nc-menu-sub-head {
  @apply pt-2 pb-2 text-gray-500 text-sm px-5;
}

.nc-workspace-menu-item {
  @apply flex items-center pl-1.5 !py-2.5 gap-2 text-sm hover:text-black;
}

:deep(.ant-dropdown-menu-item-group-title) {
  @apply hidden;
}

:deep(.ant-tabs-nav) {
  @apply !mb-0;
}

:deep(.ant-dropdown-menu-submenu-title) {
  @apply !py-0;
  .nc-icon {
    @apply !text-xs;
  }
}

:deep(.ant-menu-item-divider) {
  @apply !border-gray-200;
}
</style>
