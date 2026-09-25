<script lang="ts" setup>
/** `linkId` is empty while `isNew` — a new link is a draft until it is saved. */
const props = withDefaults(defineProps<{ linkId?: string; isNew?: boolean }>(), { linkId: '', isNew: false })

const emit = defineEmits(['done'])

const {
  links,
  target: inviteTarget,
  error,
  allowedRoles,
  disabledRoles,
  disabledRolesTooltip,
  defaultRole,
  defaultEmailDomain,
  createLink,
  saveLink,
  deleteLink,
} = useInviteLinks()

const { $e } = useNuxtApp()

const { t } = useI18n()

const { user } = useGlobal()

const link = computed(() => links.value.find((l) => l.id === props.linkId))

/** Who minted it, so a manager editing someone else's link knows whose it is. */
const createdBy = computed(() => {
  const l = link.value
  if (!l?.created_by) return ''
  if (l.created_by === user.value?.id) return t('msg.info.linkCreatedByYou')

  const name = l.created_by_display_name || l.created_by_email

  return name ? t('msg.info.linkCreatedBy', { name }) : ''
})

const draft = reactive({
  role: defaultRole.value as string,
  anyEmail: true,
  domain: '',
})

const isSaving = ref(false)

const isDeleting = ref(false)

/**
 * Checked here rather than left to the server, so a typo is answered at the
 * field instead of arriving as a toast in the far corner once the round trip
 * is done. Shown only once something has been typed -- an empty box is
 * incomplete, not wrong.
 */
const domainError = computed(() => {
  if (draft.anyEmail || !draft.domain.trim()) return ''

  return isValidEmailDomain(draft.domain) ? '' : t('msg.error.invalidEmailDomain')
})

/** A domain restriction with an empty domain would silently restrict nothing. */
const canSave = computed(() => draft.anyEmail || (!!draft.domain.trim() && !domainError.value))

function resetDraft() {
  // `error` is shared with every other screen, so a refusal from one of them
  // would otherwise greet whoever opens this one next.
  error.value = ''

  // A new link starts on what createLink would have defaulted to, so the draft
  // shows the same thing whether it is saved now or later.
  const domain = props.isNew ? defaultEmailDomain.value : link.value?.email_domain

  Object.assign(draft, {
    role: (props.isNew ? defaultRole.value : link.value?.role) ?? defaultRole.value,
    anyEmail: !domain,
    domain: domain ?? '',
  })
}

function onRoleChange(role: string) {
  draft.role = role
}

/** Picking the restricted option with nothing in the box restricts nothing, so
 *  seed it with the domain the link would have defaulted to. */
function useDomainRestriction() {
  draft.anyEmail = false

  if (!draft.domain.trim() && defaultEmailDomain.value) draft.domain = defaultEmailDomain.value
}

async function onSave() {
  if (!canSave.value) return

  isSaving.value = true

  const body = {
    role: draft.role,
    email_domain: draft.anyEmail ? null : draft.domain.trim(),
  }

  // Save is the commit point for a new link: nothing was sent when the screen
  // opened, so cancelling leaves nothing behind.
  const saved = props.isNew ? await createLink(body, { toast: false }) : await saveLink(props.linkId, body, { toast: false })

  isSaving.value = false

  // After the await, not before: a refused save must not be counted as one.
  if (saved) {
    $e(props.isNew ? 'a:invite:link:create' : 'a:invite:link:update', {
      scope: inviteTarget.value?.scope,
      role: draft.role,
      restricted: !draft.anyEmail,
      ...(props.isNew ? { from: 'list' } : {}),
    })

    emit('done')
  }
}

async function onDelete() {
  isDeleting.value = true

  const done = await deleteLink(props.linkId)

  isDeleting.value = false

  if (done) {
    $e('a:invite:link:revoke', { scope: inviteTarget.value?.scope })

    emit('done')
  }
}

watch(() => props.linkId, resetDraft)

watch(link, resetDraft, { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-5 px-7 pt-5 pb-7">
    <div v-if="createdBy" class="text-bodyDefaultSm text-nc-content-gray-muted -mt-1">{{ createdBy }}</div>

    <div class="flex flex-col gap-1.5">
      <div class="text-bodyDefaultSm font-semibold text-nc-content-gray-subtle2">{{ $t('labels.permission') }}</div>
      <RolesSelectorV2
        :on-role-change="onRoleChange"
        :role="draft.role"
        :roles="allowedRoles"
        :disabled-roles="disabledRoles"
        :disabled-roles-tooltip="disabledRolesTooltip"
        trigger-variant="field"
        size="lg"
        placement="bottomLeft"
      />
    </div>

    <div class="flex flex-col">
      <div class="text-bodyDefaultSm font-semibold text-nc-content-gray-subtle2 pb-1">{{ $t('labels.whoCanAccess') }}</div>

      <button class="flex items-center gap-3 min-h-10 text-left" data-testid="nc-hub-any-email" @click="draft.anyEmail = true">
        <span
          class="w-4 h-4 rounded-full flex-none box-border"
          :style="
            draft.anyEmail ? { border: '5px solid var(--color-brand-500)' } : { border: '1.5px solid var(--nc-border-gray-dark)' }
          "
        />
        <span class="text-bodyDefault">{{ $t('labels.allowAnyEmail') }}</span>
      </button>

      <div class="flex items-center gap-3 min-h-10">
        <button
          class="flex items-center gap-3 flex-none text-left"
          data-testid="nc-hub-domain-only"
          @click="useDomainRestriction"
        >
          <span
            class="w-4 h-4 rounded-full flex-none box-border"
            :style="
              !draft.anyEmail
                ? { border: '5px solid var(--color-brand-500)' }
                : { border: '1.5px solid var(--nc-border-gray-dark)' }
            "
          />
          <span class="text-bodyDefault whitespace-nowrap">{{ $t('labels.onlyAllowEmailsFrom') }}</span>
        </button>

        <div
          class="flex-1 flex items-center gap-1.5 h-10 px-3 rounded-lg border-1 border-nc-border-gray-medium box-border"
          :class="{ 'opacity-55': draft.anyEmail }"
        >
          <span class="text-nc-content-gray-muted">{{ '@' }}</span>
          <input
            v-model="draft.domain"
            class="flex-1 min-w-0 border-0 outline-none bg-transparent text-bodyDefault text-nc-content-gray"
            placeholder="example.com"
            data-testid="nc-hub-domain-input"
            @focus="useDomainRestriction"
          />
        </div>
      </div>

      <!-- One line, two jobs: what the restriction means, or why it will not
           save. The sentence names the domain, so it waits until there is one. -->
      <div v-if="domainError" class="text-captionSm text-nc-content-red-dark pt-1">
        {{ domainError }}
      </div>
      <div v-else-if="!draft.anyEmail && draft.domain.trim()" class="text-captionSm text-nc-content-gray-muted pt-1">
        {{ $t('msg.info.domainNeedsVerifiedEmail', { domain: draft.domain.trim() }) }}
      </div>
    </div>

    <div v-if="error" class="text-bodyDefaultSm text-nc-content-red-dark">{{ error }}</div>

    <div class="h-px bg-nc-border-gray-light" />

    <div class="flex items-center justify-between gap-3">
      <!-- Nothing to delete on a link the user has only just made; offering it
           reads as undoing the thing they just asked for. -->
      <NcButton
        v-if="!props.isNew"
        type="danger"
        size="medium"
        :loading="isDeleting"
        data-testid="nc-hub-delete-link"
        @click="onDelete"
      >
        {{ $t('activity.deleteLink') }}
      </NcButton>
      <span v-else />

      <div class="flex gap-2">
        <NcButton type="secondary" size="medium" @click="emit('done')">{{ $t('labels.cancel') }}</NcButton>
        <NcButton
          type="primary"
          size="medium"
          :disabled="!canSave"
          :loading="isSaving"
          data-testid="nc-hub-save-link"
          @click="onSave"
        >
          {{ $t('general.save') }}
        </NcButton>
      </div>
    </div>
  </div>
</template>
