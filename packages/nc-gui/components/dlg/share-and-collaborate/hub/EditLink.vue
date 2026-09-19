<script lang="ts" setup>
const props = withDefaults(defineProps<{ linkId: string; isNew?: boolean }>(), { isNew: false })

const emit = defineEmits(['done'])

const { links, allowedRoles, defaultRole, defaultEmailDomain, saveLink, deleteLink } = useInviteLinks()

const link = computed(() => links.value.find((l) => l.id === props.linkId))

const draft = reactive({
  role: defaultRole.value as string,
  anyEmail: true,
  domain: '',
})

const isSaving = ref(false)

const isDeleting = ref(false)

/** A domain restriction with an empty domain would silently restrict nothing. */
const canSave = computed(() => draft.anyEmail || !!draft.domain.trim())

function resetDraft() {
  Object.assign(draft, {
    role: link.value?.role ?? defaultRole.value,
    anyEmail: !link.value?.email_domain,
    domain: link.value?.email_domain ?? '',
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

  const saved = await saveLink(props.linkId, {
    role: draft.role,
    email_domain: draft.anyEmail ? null : draft.domain.trim(),
  })

  isSaving.value = false

  if (saved) emit('done')
}

async function onDelete() {
  isDeleting.value = true

  const done = await deleteLink(props.linkId)

  isDeleting.value = false

  if (done) emit('done')
}

watch(() => props.linkId, resetDraft)

watch(link, resetDraft, { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-5 px-7 pt-5 pb-7">
    <div class="flex flex-col gap-1.5">
      <div class="text-bodyDefaultSm font-semibold text-nc-content-gray-subtle2">{{ $t('labels.permission') }}</div>
      <RolesSelectorV2
        :on-role-change="onRoleChange"
        :role="draft.role"
        :roles="allowedRoles"
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

      <!-- The restriction only holds for a verified address, so say so here rather than at the refusal. -->
      <div v-if="!draft.anyEmail" class="text-captionSm text-nc-content-gray-muted pt-1">
        {{ $t('msg.info.domainNeedsVerifiedEmail') }}
      </div>
    </div>

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
