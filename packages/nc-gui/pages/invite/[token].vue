<script lang="ts" setup>
import type { InviteLinkPreviewType } from 'nocodb-sdk'
import { InviteLinkScope, RoleLabels } from 'nocodb-sdk'

/**
 * The join screen for a private invite link.
 *
 * Public on purpose: someone who has not signed in still needs to see what they
 * are being asked to join before making an account. The preview grants nothing,
 * and the redeem below it is a POST that requires a session.
 */
definePageMeta({
  requiresAuth: false,
  public: true,
  title: 'title.headLogin',
})

useSidebar('nc-left-sidebar', { hasSidebar: false })

const route = useRoute()

const { t } = useI18n()

const { signedIn } = useGlobal()

const { $api } = useNuxtApp()

const token = computed(() => String(route.params.token || ''))

const preview = ref<InviteLinkPreviewType | null>(null)

const isLoading = ref(true)

const isJoining = ref(false)

const loadError = ref('')

const invalidReason = computed(() => preview.value?.invalid_reason)

const roleLabel = computed(() => {
  const role = preview.value?.role
  if (!role) return ''

  return t(`objects.roleType.${RoleLabels[role] ?? role}`).toLowerCase()
})

const invalidCopy = computed(() => {
  switch (invalidReason.value) {
    case 'expired':
      return t('msg.error.inviteLinkExpired')
    case 'revoked':
      return t('msg.error.inviteLinkRevoked')
    case 'exhausted':
      return t('msg.error.inviteLinkExhausted')
    default:
      return t('msg.error.inviteLinkInvalid')
  }
})

async function loadPreview() {
  isLoading.value = true
  loadError.value = ''

  try {
    const res = await $api.instance.get(`/api/v2/invite-links/${encodeURIComponent(token.value)}`)
    preview.value = res.data
  } catch (e: any) {
    loadError.value = await extractSdkResponseErrorMsg(e)
  } finally {
    isLoading.value = false
  }
}

/** Come back here after signing in, so the link is not lost at the door. */
function goSignIn(path: '/signin' | '/signup') {
  return navigateTo({ path, query: { continueAfterSignIn: `/invite/${token.value}` } })
}

async function onJoin() {
  isJoining.value = true

  try {
    const res = await $api.instance.post(`/api/v2/invite-links/${encodeURIComponent(token.value)}/accept`)
    const { base_id: baseId, workspace_id: workspaceId } = res.data || {}

    // A hard navigation rather than a router push: membership just changed, and
    // every store holding the old permissions needs to be rebuilt.
    window.location.href = baseId ? `/nc/${baseId}` : workspaceId ? `/${workspaceId}` : '/'
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    isJoining.value = false
    // The refusal may be about the link itself, so re-read its state.
    await loadPreview()
  }
}

onMounted(loadPreview)
</script>

<template>
  <div>
    <NuxtLayout>
      <div class="nc-invite-page flex items-center justify-center min-h-full py-16 bg-nc-bg-default px-6">
        <div class="w-full max-w-100 flex flex-col items-center gap-6">
          <div class="relative h-12 w-12 flex-none">
            <GeneralNocoIcon :size="40" />
          </div>

          <div v-if="isLoading" class="flex flex-col items-center gap-3 w-full">
            <span class="h-5 w-48 rounded bg-nc-bg-gray-light" />
            <span class="h-10 w-full rounded-lg bg-nc-bg-gray-light" />
          </div>

          <template v-else-if="loadError">
            <div class="text-heading3 text-nc-content-gray text-center">{{ $t('msg.error.inviteLinkInvalid') }}</div>
            <div class="text-bodyDefault text-nc-content-gray-subtle2 text-center">{{ loadError }}</div>
            <NcButton type="secondary" size="medium" @click="navigateTo('/')">{{ $t('general.home') }}</NcButton>
          </template>

          <template v-else-if="invalidReason">
            <div class="text-heading3 text-nc-content-gray text-center" data-testid="nc-invite-invalid">{{ invalidCopy }}</div>
            <div class="text-bodyDefault text-nc-content-gray-subtle2 text-center">{{ $t('msg.info.askForANewLink') }}</div>
            <NcButton type="secondary" size="medium" @click="navigateTo('/')">{{ $t('general.home') }}</NcButton>
          </template>

          <template v-else>
            <div class="flex flex-col items-center gap-2 text-center">
              <div class="text-heading3 text-nc-content-gray" data-testid="nc-invite-heading">
                {{
                  preview?.scope === InviteLinkScope.WORKSPACE
                    ? $t('msg.info.invitedToWorkspace', { name: preview?.target_title })
                    : $t('msg.info.invitedToBase', { name: preview?.target_title })
                }}
              </div>
              <div class="text-bodyDefault text-nc-content-gray-subtle2">
                {{ $t('msg.info.youWillJoinAs', { role: roleLabel }) }}
              </div>
              <div v-if="preview?.email_domain" class="text-bodyDefaultSm text-nc-content-gray-muted">
                {{ $t('msg.info.domainNeedsVerifiedEmail') }}
              </div>
            </div>

            <NcButton
              v-if="signedIn"
              type="primary"
              size="medium"
              class="!w-full"
              :loading="isJoining"
              data-testid="nc-invite-join"
              @click="onJoin"
            >
              <span class="flex w-full items-center justify-center">{{ $t('activity.joinNow') }}</span>
            </NcButton>

            <div v-else class="flex flex-col gap-2 w-full">
              <NcButton type="primary" size="medium" class="!w-full" data-testid="nc-invite-signup" @click="goSignIn('/signup')">
                <span class="flex w-full items-center justify-center">{{ $t('activity.createAccountToJoin') }}</span>
              </NcButton>
              <NcButton
                type="secondary"
                size="medium"
                class="!w-full"
                data-testid="nc-invite-signin"
                @click="goSignIn('/signin')"
              >
                <span class="flex w-full items-center justify-center">{{ $t('activity.signInToJoin') }}</span>
              </NcButton>
            </div>
          </template>
        </div>
      </div>
    </NuxtLayout>
  </div>
</template>
