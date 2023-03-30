<script lang="ts" setup>
import { LoadingOutlined } from '@ant-design/icons-vue'
import ManageUsers from './ManageUsers.vue'
import ShareProject from './ShareProject.vue'
import SharePage from './SharePage.vue'

const { copy } = useCopy()
const { dashboardUrl } = $(useDashboard())
const { project } = storeToRefs(useProject())
const { openedPage, nestedPagesOfProjects } = storeToRefs(useDocStore())

const { formStatus, showShareModal, invitationValid, invitationUsersData } = storeToRefs(useShare())
const { inviteUser } = useManageUsers()

const isInvitationLinkCopied = ref(false)
const expandedSharedType = ref<'none' | 'project' | 'page'>('project')

const page = computed(() => openedPage.value ?? nestedPagesOfProjects.value[project.value.id!]?.[0])

const inviteUrl = computed(() =>
  invitationUsersData.value.invitationToken ? `${dashboardUrl}#/signup/${invitationUsersData.value.invitationToken}` : null,
)

const indicator = h(LoadingOutlined, {
  style: {
    fontSize: '24px',
  },
  spin: true,
})

const onShare = async () => {
  if (!invitationValid) return

  await inviteUser({
    email: invitationUsersData.value.emails!,
    roles: invitationUsersData.value.role!,
  })
}

const copyInvitationLink = async () => {
  await copy(inviteUrl.value!)

  isInvitationLinkCopied.value = true
}

watch(showShareModal, (val) => {
  if (!val) {
    setTimeout(() => {
      formStatus.value = 'project-collaborate'
    }, 500)
  }
})
</script>

<template>
  <a-modal
    v-model:visible="showShareModal"
    class="!top-[35%]"
    :class="{ active: showShareModal }"
    wrap-class-name="nc-modal-share-collaborate"
    :closable="false"
    :mask-closable="formStatus === 'project-collaborateSaving' ? false : true"
    :ok-button-props="{ hidden: true } as any"
    :cancel-button-props="{ hidden: true } as any"
    :footer="null"
    :centered="true"
    :width="formStatus === 'manageCollaborators' ? '60rem' : '40rem'"
  >
    <div v-if="formStatus === 'project-collaborateSaving'" class="flex flex-row w-full px-5 justify-between items-center py-0.5">
      <div class="flex text-base" :style="{ fontWeight: 500 }">Adding Collaborators</div>
      <a-spin :indicator="indicator" />
    </div>
    <template v-else-if="formStatus === 'project-collaborateSaved'">
      <div class="flex flex-col">
        <div class="flex flex-row w-full px-5 justify-between items-center py-0.5">
          <div class="flex text-base" :style="{ fontWeight: 500 }">Collaborators added</div>
          <div class="flex"><MdiCheck /></div>
        </div>
        <div class="flex flex-row mx-3 mt-2.5 pt-3.5 border-t-1 border-gray-100 justify-end gap-x-2">
          <a-button type="text" class="!border-1 !border-gray-200 !rounded-md" @click="showShareModal = false">Close</a-button>
          <a-button type="text" class="!border-1 !border-gray-200 !rounded-md" @click="copyInvitationLink">
            <div v-if="isInvitationLinkCopied" class="flex flex-row items-center gap-x-1">
              <MdiTick class="h-3.5" />
              Copied invite link
            </div>
            <div v-else class="flex flex-row items-center gap-x-1">
              <MdiContentCopy class="h-3.3" />
              Copy invite link
            </div>
          </a-button>
        </div>
      </div>
    </template>
    <div v-else-if="formStatus === 'manageCollaborators'">
      <ManageUsers v-if="formStatus === 'manageCollaborators'" @close="formStatus = 'collaborate'" />
    </div>
    <div v-else class="flex flex-col px-1">
      <div class="flex flex-row justify-between items-center pb-1.5 mx-4">
        <div class="flex text-lg py-1" style="font-weight: 500">Share</div>
      </div>
      <a-collapse v-model:active-key="expandedSharedType" expand-icon-position="right" class="!mx-3" :accordion="true">
        <a-collapse-panel key="project" class="share-collapse-item">
          <template #header>
            <div class="flex flex-row items-center gap-x-2">
              <PhBook />
              <div data-testid="docs-share-dlg-share-page">
                Share Document <span class="ml-2 py-1 px-2 rounded-md bg-gray-100 capitalize">{{ project.title }}</span>
              </div>
            </div>
          </template>
          <ShareProject />
        </a-collapse-panel>
        <a-collapse-panel v-if="page" key="page" class="share-collapse-item">
          <template #header>
            <div class="flex flex-row items-center gap-x-2">
              <IonDocumentOutline />
              <div data-testid="docs-share-dlg-share-page">
                Share Page <span class="ml-10.5 py-1 px-2 rounded-md bg-gray-100 capitalize">{{ page.title }}</span>
              </div>
            </div>
          </template>
          <SharePage />
        </a-collapse-panel>
      </a-collapse>
      <div class="flex flex-row justify-end mx-3 mt-6 mb-2 border-t-1 !border-gray-100 pt-4 gap-x-2">
        <a-button
          v-if="formStatus === 'project-collaborate'"
          type="text"
          class="!border-1 !border-gray-200 !rounded-md"
          @click="showShareModal = false"
        >
          Cancel
        </a-button>
        <a-button type="text" class="!border-1 !border-gray-200 !rounded-md" @click="formStatus = 'manageCollaborators'"
          >Manage project access</a-button
        >
        <a-button
          v-if="formStatus !== 'project-collaborate'"
          type="text"
          class="!border-1 !border-gray-200 !rounded-md"
          @click="showShareModal = false"
        >
          Finish
        </a-button>
        <a-button
          v-if="formStatus === 'project-collaborate'"
          class="!border-0 !rounded-md"
          type="primary"
          :disabled="!invitationValid"
          @click="onShare"
        >
          Share
        </a-button>
      </div>
    </div>
  </a-modal>
</template>

<style lang="scss" scoped>
.share-collapse-item {
  @apply !rounded-lg !mb-2 !mt-4 !border-0;
}
.ant-collapse {
  @apply !bg-white !border-0;
}
</style>

<style lang="scss">
.nc-modal-share-collaborate {
  .ant-collapse-item {
    @apply !border-1 border-gray-200;
  }
  .ant-collapse-content {
    @apply !border-t-0;
  }
  .ant-collapse-content-box {
    @apply !p-0;
  }

  .ant-modal-content {
    @apply !rounded-lg;
  }
  .ant-modal-body {
    @apply !py-2.5 !px-1;
  }
  .ant-select-selector {
    @apply !rounded-md !border-gray-200 !border-1;
  }
  .ant-form-item {
    @apply !my-0;
  }
  .ant-form-item-explain {
    @apply !ml-3;
  }
  .ant-select {
    @apply !p-0.5;
  }
  .ant-select-selector {
    @apply !bg-gray-100;
  }
}
</style>
