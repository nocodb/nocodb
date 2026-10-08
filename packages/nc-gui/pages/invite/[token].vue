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
  title: 'title.headJoin',
})

useSidebar('nc-left-sidebar', { hasSidebar: false })

const route = useRoute()

const { t } = useI18n()

const { signedIn, user, signOut } = useGlobal()

const { $api, $e } = useNuxtApp()

const token = computed(() => String(route.params.token || ''))

const preview = ref<InviteLinkPreviewType | null>(null)

/** Event names carry the scope segment; a base link is the default until the preview says otherwise. */
const isWorkspaceInvite = computed(() => preview.value?.scope === InviteLinkScope.WORKSPACE)

const isLoading = ref(true)

/** Held true while the browser navigates away, so the card never flashes. */
const isRedirecting = ref(false)

const isJoining = ref(false)

const loadError = ref('')

/** Shown inline under the button: a refusal the page could not predict. */
const joinError = ref('')

const invalidReason = computed(() => preview.value?.invalid_reason)

/**
 * Same rule as the server's emailMatchesDomain, so the page can turn the
 * refusal into a "switch account" prompt instead of a failed click.
 */
const wrongDomain = computed(() => {
  const domain = preview.value?.email_domain
  const email = user.value?.email

  if (!signedIn.value || !domain || !email) return false

  return !email.toLowerCase().endsWith(`@${domain.toLowerCase()}`)
})

const roleLabel = computed(() => {
  const role = preview.value?.role
  if (!role) return ''

  const phrase = inviteLinkRolePhrase(preview.value?.scope, role, { article: true })
  if (phrase) return phrase

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
    // Intact, but its base was deleted or made private after it was minted.
    case 'unavailable':
      return t('msg.error.inviteLinkUnavailable')
    default:
      return t('msg.error.inviteLinkInvalid')
  }
})

/** EE routes a base under its workspace; CE has no workspace and uses the `nc` placeholder. */
function landingPath({
  base_id: baseId,
  workspace_id: workspaceId,
  interface_id: interfaceId,
}: {
  base_id?: string | null
  workspace_id?: string | null
  interface_id?: string | null
}) {
  if (baseId && interfaceId) return `/${workspaceId ?? 'nc'}/${baseId}/interfaces/${interfaceId}`

  return baseId ? `/${workspaceId ?? 'nc'}/${baseId}` : workspaceId ? `/${workspaceId}` : '/'
}

async function loadPreview() {
  isLoading.value = true
  loadError.value = ''

  try {
    const res = await $api.instance.get(`/api/v2/invite-links/${encodeURIComponent(token.value)}`)

    // Already a member at this role or better: nothing to join, so open the
    // target. `finally` still runs on this return, so the skeleton has to be
    // held open explicitly -- otherwise the invite card renders with a blank
    // name, a blank role and a live Join button for the whole navigation.
    if (res.data?.already_member) {
      $e(res.data.scope === InviteLinkScope.WORKSPACE ? 'c:ws:invite:link:view' : 'c:base:invite:link:view', {
        scope: res.data.scope,
        state: 'already_member',
      })
      isRedirecting.value = true
      window.location.replace(landingPath(res.data))
      return
    }

    preview.value = res.data

    $e(res.data?.scope === InviteLinkScope.WORKSPACE ? 'c:ws:invite:link:view' : 'c:base:invite:link:view', {
      scope: res.data?.scope,
      state: res.data?.invalid_reason ?? 'ok',
      restricted: !!res.data?.email_domain,
      signedIn: signedIn.value,
    })
  } catch (e: any) {
    loadError.value = await extractSdkResponseErrorMsg(e)
    // the link could not be read, so its scope is unknown
    $e('c:invite:link:view:error')
  } finally {
    isLoading.value = false
  }
}

/** Come back here after signing in, so the link is not lost at the door. */
function goSignIn(path: '/signin' | '/signup') {
  $e(
    path === '/signup'
      ? isWorkspaceInvite.value
        ? 'c:ws:invite:link:sign-up'
        : 'c:base:invite:link:sign-up'
      : isWorkspaceInvite.value
      ? 'c:ws:invite:link:sign-in'
      : 'c:base:invite:link:sign-in',
    { scope: preview.value?.scope },
  )

  return navigateTo({ path, query: { continueAfterSignIn: `/invite/${token.value}` } })
}

/** Sign out, then come back here as someone else. */
function switchAccount() {
  $e(isWorkspaceInvite.value ? 'c:ws:invite:link:switch-account' : 'c:base:invite:link:switch-account', {
    scope: preview.value?.scope,
    reason: wrongDomain.value ? 'wrong_domain' : 'refused',
  })

  return signOut({
    redirectToSignin: true,
    signinUrl: `/signin?continueAfterSignIn=${encodeURIComponent(`/invite/${token.value}`)}`,
  })
}

async function onJoin() {
  isJoining.value = true
  joinError.value = ''

  try {
    const res = await $api.instance.post(`/api/v2/invite-links/${encodeURIComponent(token.value)}/accept`)

    $e(isWorkspaceInvite.value ? 'a:ws:invite:link:accept' : 'a:base:invite:link:accept', {
      scope: preview.value?.scope,
      restricted: !!preview.value?.email_domain,
    })

    // Same hold as the already-member path: the card must not sit on screen
    // through the navigation, or the browser has a live Join button to restore
    // if the user comes back to this URL.
    isRedirecting.value = true

    // A hard navigation rather than a router push: membership just changed, and
    // every store holding the old permissions needs to be rebuilt.
    window.location.href = landingPath(res.data || {})
  } catch (e: any) {
    joinError.value = await extractSdkResponseErrorMsg(e)
    $e(isWorkspaceInvite.value ? 'a:ws:invite:link:accept:refused' : 'a:base:invite:link:accept:refused', {
      scope: preview.value?.scope,
      status: e?.response?.status,
    })
    isJoining.value = false
    // The refusal may be about the link itself, so re-read its state.
    await loadPreview()
  }
}

onMounted(() => {
  loadPreview()

  // Restored from the back/forward cache, the page keeps the DOM it had when
  // the user left -- which, right after a join, is the card with a live Join
  // button. Nothing re-runs on that path, so ask again.
  useEventListener(window, 'pageshow', (e: PageTransitionEvent) => {
    if (e.persisted) loadPreview()
  })
})
</script>

<template>
  <NuxtLayout>
    <AuthShell v-if="isLoading || isRedirecting" class="nc-invite-page" :title="$t('labels.auth.inviteTitle')" :loading="true">
      <div class="flex flex-col gap-3 w-full">
        <span class="h-5 w-48 rounded bg-nc-bg-gray-light" />
        <span class="h-11 w-full rounded-lg bg-nc-bg-gray-light" />
      </div>
    </AuthShell>

    <AuthShell v-else-if="loadError" class="nc-invite-page" :title="$t('msg.error.inviteLinkInvalid')" :subtitle="loadError">
      <NcButton type="primary" class="nc-auth-primary w-full" @click="navigateTo('/')">{{ $t('general.home') }}</NcButton>
    </AuthShell>

    <AuthShell
      v-else-if="invalidReason"
      class="nc-invite-page"
      data-testid="nc-invite-invalid"
      :title="invalidCopy"
      :subtitle="$t('msg.info.askForANewLink')"
    >
      <NcButton type="primary" class="nc-auth-primary w-full" @click="navigateTo('/')">{{ $t('general.home') }}</NcButton>
    </AuthShell>

    <!-- `preview`, not a bare `v-else`: with nothing to show this rendered a
         card with a blank name and a live Join button. -->
    <AuthShell
      v-else-if="preview"
      class="nc-invite-page"
      data-testid="nc-invite-heading"
      :title="
        preview.scope === InviteLinkScope.WORKSPACE
          ? $t('msg.info.invitedToWorkspace', { name: preview.target_title })
          : $t('msg.info.invitedToBase', { name: preview.target_title })
      "
      :subtitle="
        signedIn && wrongDomain
          ? $t('msg.info.joinAsWithDomainAccount', { role: roleLabel, domain: preview.email_domain })
          : $t('msg.info.youWillJoinAs', { role: roleLabel })
      "
    >
      <!-- Signed in with the wrong domain, the subtitle and the line below already say it. -->
      <div
        v-if="preview.email_domain && !(signedIn && wrongDomain)"
        class="text-bodyDefaultSm text-nc-content-gray-muted -mt-4 mb-6"
      >
        {{ $t('msg.info.domainNeedsVerifiedEmail', { domain: preview.email_domain }) }}
      </div>

      <div v-if="signedIn && wrongDomain" class="flex flex-col gap-3 w-full">
        <p class="text-bodyDefaultSm text-nc-content-gray-subtle m-0" data-testid="nc-invite-wrong-domain">
          {{ $t('msg.info.signedInWrongDomain', { email: user?.email, domain: preview.email_domain }) }}
        </p>
        <NcButton type="primary" class="nc-auth-primary w-full" data-testid="nc-invite-switch-account" @click="switchAccount">
          {{ $t('activity.signInWithDifferentAccount') }}
        </NcButton>
      </div>

      <div v-else-if="signedIn" class="flex flex-col gap-3 w-full">
        <AuthSubmitButton
          :error="joinError"
          error-testid="nc-invite-join-error"
          :loading="isJoining"
          data-testid="nc-invite-join"
          @click="onJoin"
        >
          {{ $t('activity.joinNow') }}
        </AuthSubmitButton>

        <template v-if="joinError">
          <div class="text-bodyDefaultSm text-nc-content-gray-muted text-center">
            {{ $t('msg.info.signedInAs', { email: user?.email }) }}
          </div>
          <NcButton type="secondary" class="w-full" data-testid="nc-invite-switch-account" @click="switchAccount">
            {{ $t('activity.signInWithDifferentAccount') }}
          </NcButton>
        </template>
      </div>

      <div v-else class="flex flex-col gap-2 w-full">
        <NcButton type="primary" class="nc-auth-primary w-full" data-testid="nc-invite-signup" @click="goSignIn('/signup')">
          {{ $t('activity.createAccountToJoin') }}
        </NcButton>
        <NcButton type="secondary" class="w-full" data-testid="nc-invite-signin" @click="goSignIn('/signin')">
          {{ $t('activity.signInToJoin') }}
        </NcButton>
      </div>

      <!-- Signing out is a heavy price for opening the wrong link. The
           account they are in is still theirs; let them go back to it. -->
      <template v-if="signedIn && (wrongDomain || joinError)" #footer>
        <NuxtLink class="nc-auth-link" data-testid="nc-invite-home" to="/">{{ $t('general.home') }}</NuxtLink>
      </template>
    </AuthShell>
  </NuxtLayout>
</template>
