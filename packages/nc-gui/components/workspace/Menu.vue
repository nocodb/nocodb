<script lang="ts" setup>
import {onMounted, ref, useWorkspace} from '#imports'
import {storeToRefs} from 'pinia'
import {WorkspaceType} from "nocodb-sdk";
import {navigateTo} from "#app";

const props = defineProps<{
  isOpen: boolean
}>()

const workspaceStore = useWorkspace()

const {workspace, workspaces, isWorkspaceOwner} = storeToRefs(workspaceStore)


onMounted(async () => {
  await workspaceStore.loadWorkspaceList()
});


const workspaceModalVisible = ref(false)

const createDlg = ref(false)


const onWorkspaceCreate = async (workspace: WorkspaceType) => {
  createDlg.value = false
  await workspaceStore.loadWorkspaceList()
  navigateTo(`/ws/${workspace.id}`)
}

// todo: temp
const isSharedBase = false
const modalVisible = false
</script>

<template>
  <div class="flex-grow min-w-20">
    <a-dropdown class="h-full min-w-0 flex-1" :trigger="['click']" placement="bottom"
                overlay-class-name="nc-dropdown-project-menu">
      <div
          :style="{ width: props.isOpen ? 'calc(100% - 40px) pr-2' : '100%' }"
          :class="[props.isOpen ? '' : 'justify-center']"
          data-testid="nc-project-menu"
          class="group cursor-pointer flex gap-1 items-center nc-project-menu overflow-hidden"
      >
        <template v-if="props.isOpen">
          <a-tooltip v-if="workspace?.title?.length > 12" placement="bottom">
            <div class="text-md font-semibold truncate">{{ workspace.title }}</div>
            <template #title>
              <div class="text-sm !text-red-500">{{ workspace?.title }}</div>
            </template>
          </a-tooltip>
          <div v-else class="text-md font-semibold truncate capitalize">{{ workspace?.title }}</div>

          <MdiChevronDown class="min-w-[17px] text-md"/>
        </template>

        <template v-else>
          <MdiFolder class="text-primary cursor-pointer transform hover:scale-105 text-2xl"/>
        </template>
      </div>

      <template #overlay>

        <a-menu class="!ml-1 !w-[300px] !text-sm">


          <a-menu-item-group>
            <template #title>
              <div class="group select-none flex items-center gap-4 py-1">
                <MdiFolder class="group-hover:text-accent text-xl"/>

                <div class="flex flex-col">
                  <div class="text-lg group-hover:(!text-primary) font-semibold capitalize">
                    <GeneralTruncateText>{{ workspace.title }}</GeneralTruncateText>
                  </div>

                  <div v-if="!isSharedBase" class="flex items-center gap-1">
                    <div class="group-hover:(!text-primary)">ID:</div>

                    <div class="text-xs group-hover:text-accent truncate font-italic">{{ workspace.id }}</div>
                  </div>
                </div>
              </div>
            </template>
            <div class="pt-2 pb-2 text-gray-400 font-weight-bold text-xs px-3">Workspace Options</div>

            <a-menu-item @click="workspaceModalVisible = true">
              <div class="nc-project-menu-item group">
                <PhUserCircleThin/>
                Collaborators
              </div>
            </a-menu-item>
            <a-menu-item @click="workspaceModalVisible = true">
              <div class="nc-project-menu-item group">
                <PhFadersThin/>
                Settings
              </div>
            </a-menu-item>

            <a-menu-divider class="my-2"/>

            <div class="pt-2 pb-2 text-gray-400 font-weight-bold text-xs px-3">Workspaces</div>


            <div class="max-h-300px overflow-y-auto">
              <a-menu-item v-for="workspace of workspaces" @click="navigateTo(`/ws/${workspace.id}`)">
                <div class="nc-project-menu-item group">
                  <PhBrowserThin/>

                  {{ workspace.title }}
                </div>
              </a-menu-item>
            </div>
            <a-menu-divider class="my-2"/>

            <a-menu-item @click="createDlg = true">
              <div class="nc-project-menu-item group">
                <PhPlusThin/>

                Add new workspace
              </div>
            </a-menu-item>
            <!--
                      <template v-if="!isSharedBase">
                        &lt;!&ndash; Copy Project Info &ndash;&gt;
                        <a-menu-item key="copy">
                          <div v-e="['c:navbar:user:copy-proj-info']" class="nc-project-menu-item group" @click.stop="copyProjectInfo">
                            <MdiContentCopy class="group-hover:text-accent" />
                            {{ $t('activity.account.projInfo') }}
                          </div>
                        </a-menu-item>

                        <a-menu-divider />

                        &lt;!&ndash; Swagger: Rest APIs &ndash;&gt;
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

                        &lt;!&ndash; Copy Auth Token &ndash;&gt;
                        <a-menu-item key="copy">
                          <div v-e="['a:navbar:user:copy-auth-token']" class="nc-project-menu-item group" @click.stop="copyAuthToken">
                            <MdiScriptTextKeyOutline class="group-hover:text-accent" />
                            {{ $t('activity.account.authToken') }}
                          </div>
                        </a-menu-item>

                        <a-menu-divider />

                        &lt;!&ndash; Team & Settings &ndash;&gt;
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

                        &lt;!&ndash; Theme &ndash;&gt;
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

                            &lt;!&ndash; Custom Theme &ndash;&gt;
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

                              &lt;!&ndash; Primary Color &ndash;&gt;
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

                              &lt;!&ndash; Accent Color &ndash;&gt;
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

                        &lt;!&ndash; Preview As &ndash;&gt;
                        <a-sub-menu v-if="isUIAllowed('previewAs')" key="preview-as">
                          <template #title>
                            <div v-e="['c:navdraw:preview-as']" class="nc-project-menu-item group">
                              <MdiFileEyeOutline class="group-hover:text-accent" />
                              {{ $t('activity.previewAs') }}

                              <div class="flex-1" />

                              <MaterialSymbolsChevronRightRounded
                                class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                              />
                            </div>
                          </template>

                          <template #expandIcon></template>

                          <LazyGeneralPreviewAs />
                        </a-sub-menu>
                      </template>
                      &lt;!&ndash; Language &ndash;&gt;
                      <a-sub-menu
                        key="language"
                        class="lang-menu !py-0"
                        popup-class-name="scrollbar-thin-dull min-w-50 max-h-90vh !overflow-auto"
                      >
                        <template #title>
                          <div class="nc-project-menu-item group">
                            <MaterialSymbolsTranslate class="group-hover:text-accent nc-language" />
                            {{ $t('labels.language') }}
                            <div class="flex items-center text-gray-400 text-xs">(Community Translated)</div>
                            <div class="flex-1" />

                            <MaterialSymbolsChevronRightRounded class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400" />
                          </div>
                        </template>

                        <template #expandIcon></template>

                        <LazyGeneralLanguageMenu />
                      </a-sub-menu>

                      &lt;!&ndash; Account &ndash;&gt;
                      <template v-if="signedIn && !isSharedBase">
                        <a-sub-menu key="account">
                          <template #title>
                            <div class="nc-project-menu-item group">
                              <MdiAccount class="group-hover:text-accent" />
                              {{ $t('labels.account') }}
                              <div class="flex-1" />

                              <MaterialSymbolsChevronRightRounded
                                class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                              />
                            </div>
                          </template>

                          <template #expandIcon></template>

                          <a-menu-item key="0" class="!rounded-t">
                            <nuxt-link v-e="['c:navbar:user:email']" class="nc-project-menu-item group !no-underline" to="/account/users">
                              <MdiAt class="mt-1 group-hover:text-accent" />&nbsp;
                              <div class="prose-sm group-hover:text-primary">
                                <div>Account</div>
                                <div class="text-xs text-gray-500">{{ email }}</div>
                              </div>
                            </nuxt-link>
                          </a-menu-item>

                          <a-menu-item key="1" class="!rounded-b">
                            <div v-e="['a:navbar:user:sign-out']" class="nc-project-menu-item group" @click="logout">
                              <MdiLogout class="group-hover:(!text-accent)" />&nbsp;

                              <span class="prose-sm nc-user-menu-signout">
                                {{ $t('general.signOut') }}
                              </span>
                            </div>
                          </a-menu-item>
                        </a-sub-menu>
                      </template>-->
          </a-menu-item-group>
        </a-menu>
      </template>
    </a-dropdown>
    <a-modal
        v-model:visible="workspaceModalVisible"
        :class="{ active: modalVisible }"
        width="80%"
        :footer="null"
    >
      <a-tabs v-model:activeKey="tab">
        <!--        <a-tab-pane key="projects" tab="All Projects" class="w-full">-->
        <!--          <WorkspaceProjectList class="h-full" />-->
        <!--        </a-tab-pane>-->
        <template v-if="isWorkspaceOwner">
          <a-tab-pane key="collab" tab="Collaborators" class="w-full">
            <WorkspaceCollaboratorsList class="h-full overflow-auto"/>
          </a-tab-pane>
          <a-tab-pane key="settings" tab="Settings" class="w-full">
            <div class="min-h-50 flex items-center justify-center">
              Not available
            </div>
          </a-tab-pane>
        </template>
      </a-tabs>

    </a-modal>

    <WorkspaceCreateDlg v-model="createDlg" @success="onWorkspaceCreate"/>
  </div>
</template>
