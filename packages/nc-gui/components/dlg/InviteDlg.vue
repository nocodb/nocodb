<script lang="ts" setup>
import type { TeamV3V3Type, UserType } from 'nocodb-sdk'
import { InviteLinkScope } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: boolean
  type?: 'base' | 'workspace' | 'organization'
  isTeam?: boolean
  baseId?: string
  emails?: string[]
  workspaceId?: string
  users?: Array<Pick<UserType, 'email'>>
  teams?: Array<TeamV3V3Type>
  existingTeamIds?: string[]
}>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const { $e } = useNuxtApp()

const dialogShow = useVModel(props, 'modelValue', emit)

const { load: loadInviteLinks, defaultEmailDomain } = useInviteLinks()

/** Their own domain makes the example read as their team, not a stock address. */
const emailPlaceholder = computed(() =>
  defaultEmailDomain.value
    ? `name1@${defaultEmailDomain.value}, name2@${defaultEmailDomain.value}`
    : 'name@example.com, another@example.com',
)

/**
 * Both the base and the workspace invite offer a link. The team pickers do not:
 * a team link would hand out membership of a group rather than of a thing,
 * which is a different grant.
 */
const { isUIAllowed } = useRoles()

/** Email invites are viewer+ on a base; minting a link is editor+. */
const canInviteByEmail = computed(() => (props.type === 'base' ? isUIAllowed('userInvite') : true))

const linkTarget = computed(() => {
  if (props.isTeam) return null

  // Minting a link is editor+ (capped server-side at the caller's own role);
  // inviting by email is viewer+. Both moved on 2026-09-19.
  if (props.type === 'base' && !isUIAllowed('baseInviteLinkCreate')) return null

  if (props.type === 'workspace' && !isUIAllowed('workspaceInviteLinkCreate')) return null

  if (props.type === 'base' && props.baseId) {
    return { scope: InviteLinkScope.BASE, baseId: props.baseId }
  }

  if (props.type === 'workspace' && props.workspaceId) {
    return { scope: InviteLinkScope.WORKSPACE, workspaceId: props.workspaceId }
  }

  return null
})

const showLinks = computed(() => !!linkTarget.value)

const screen = ref<'main' | 'compose' | 'links' | 'edit'>('main')

const editLinkId = ref('')

const editLinkIsNew = ref(false)

const heading = computed(() => {
  if (screen.value === 'compose') return t('labels.inviteSpecificPeople')
  if (screen.value === 'links') return t('activity.inviteLinks')
  if (screen.value === 'edit') return t(editLinkIsNew.value ? 'activity.newInviteLink' : 'activity.editInviteLink')

  if (props.type === 'organization') return 'Invite Members to Workspaces'

  if (props.type === 'base') return props.isTeam ? t('activity.addTeamsToBase') : t('activity.addMember')

  return props.isTeam ? t('activity.addTeamsToWorkspace') : t('activity.inviteToWorkspace')
})

function openEditLink(linkId: string, isNew = false) {
  $e(props.type === 'workspace' ? 'c:invite:workspace:link:settings:open' : 'c:invite:base:link:settings:open', { isNew })

  editLinkId.value = linkId
  editLinkIsNew.value = isNew
  screen.value = 'edit'
}

function goMain() {
  screen.value = 'main'
}

function openLinks() {
  $e(props.type === 'workspace' ? 'c:invite:workspace:link:list:open' : 'c:invite:base:link:list:open')
  screen.value = 'links'
}

function openCompose() {
  $e(
    props.type === 'workspace'
      ? 'c:invite:workspace:email:compose'
      : props.type === 'organization'
      ? 'c:invite:organization:email:compose'
      : 'c:invite:base:email:compose',
  )
  screen.value = 'compose'
}

watch(dialogShow, (open) => {
  if (!open) {
    screen.value = 'main'
    return
  }

  // Forced, for the same reason as the share hub: reopening is the moment the
  // user expects to be looking at what is actually there.
  // `linkTarget` is already null when the caller may not manage links, so this
  // never asks for a list it would be refused.
  if (linkTarget.value) loadInviteLinks(linkTarget.value, true)
})
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    :header="$t('activity.createTable')"
    :show-separator="false"
    size="medium"
    class="nc-invite-dlg"
    @keydown.esc="dialogShow = false"
  >
    <template #header>
      <div class="flex flex-row text-xl font-semibold items-center gap-x-2">
        <NcButton v-if="screen !== 'main'" type="text" size="xsmall" class="!px-0 !w-7" @click="goMain">
          <GeneralIcon icon="ncArrowLeft" class="w-4 h-4" />
        </NcButton>
        {{ heading }}
      </div>
    </template>

    <template v-if="screen === 'main'">
      <!-- Link first, same order as the share hub: the link is the fast path and
           the named invite is the deliberate one. -->
      <!-- Named invites lead here: this dialog is opened from a members page,
           where the intent is already "add this person". The share hub keeps
           the link first, where the intent is to share. -->
      <template v-if="showLinks">
        <template v-if="canInviteByEmail">
          <div class="text-bodyDefault font-semibold text-nc-content-gray mb-2">
            {{ $t('labels.inviteSpecificPeople') }}
          </div>

          <!-- A doorway, not the form: the role belongs on the compose screen, so
             it is not stated twice under a link that already names one. -->
          <input
            class="nc-hub-email-field w-full h-10 px-3 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default outline-none text-bodyDefault text-nc-content-gray hover:border-nc-border-gray-dark"
            :placeholder="emailPlaceholder"
            data-testid="nc-hub-invite-by-email"
            readonly
            @focus="openCompose"
            @click="openCompose"
          />

          <div class="h-px bg-nc-border-gray-light my-5" />
        </template>

        <DlgShareAndCollaborateHubLinkBlock @manage="openLinks" />
      </template>

      <DlgInviteForm
        v-else
        :active="dialogShow"
        :type="type"
        :is-team="isTeam"
        :base-id="baseId"
        :emails="emails"
        :workspace-id="workspaceId"
        :users="users"
        :teams="teams"
        :existing-team-ids="existingTeamIds"
        @close="dialogShow = false"
      />
    </template>

    <DlgInviteForm
      v-else-if="screen === 'compose'"
      :active="dialogShow"
      :type="type"
      :is-team="isTeam"
      :base-id="baseId"
      :emails="emails"
      :workspace-id="workspaceId"
      :users="users"
      :teams="teams"
      :existing-team-ids="existingTeamIds"
      layout="compose"
      @close="dialogShow = false"
    />

    <DlgShareAndCollaborateHubLinks v-else-if="screen === 'links'" class="!px-0" @edit-link="openEditLink" />

    <DlgShareAndCollaborateHubEditLink v-else class="!px-0" :link-id="editLinkId" :is-new="editLinkIsNew" @done="goMain" />
  </NcModal>
</template>

<style lang="scss">
// The picker dropdown is absolutely positioned underneath the email input,
// but ant-modal's body clips overflow by default. Allow visible overflow only
// for this dialog so the dropdown isn't cut off when it extends past the
// modal's inner edge.
.nc-invite-dlg .ant-modal-body,
.nc-invite-dlg .ant-modal-content {
  overflow: visible !important;
}
</style>
