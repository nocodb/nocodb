<script lang="ts" setup>
import { InviteLinkScope } from 'nocodb-sdk'

/**
 * The private-link block. There is no separate "create" step: the link is a
 * detail of copying one, so it is minted on the first copy and never just
 * because a modal opened.
 */
const emit = defineEmits(['manage'])

const { t } = useI18n()

const {
  links,
  target: inviteTarget,
  linkUrl,
  isLoading,
  isLoaded,
  allowedRoles,
  disabledRoles,
  disabledRolesTooltip,
  defaultRole,
  defaultEmailDomain,
  createLink,
  saveLink,
} = useInviteLinks()

const isWorkspaceInvite = computed(() => inviteTarget.value?.scope === InviteLinkScope.WORKSPACE)

const { copy } = useCopy()

const { $e } = useNuxtApp()

const primary = computed(() => links.value[0])

const isBusy = ref(false)

const isCopied = ref(false)

let copiedTimer: ReturnType<typeof setTimeout> | undefined

/** Until a link exists these mirror what one would be created with. */
const pendingRole = ref<string | null>(null)

const role = computed(() => primary.value?.role ?? pendingRole.value ?? defaultRole.value)

const domain = computed(() => (primary.value ? primary.value.email_domain : defaultEmailDomain.value))

/** Nothing to manage until a link exists. */
const hasLink = computed(() => !!primary.value)

const ctaLabel = computed(() => (hasLink.value ? t('activity.copyInviteLink') : t('activity.createInviteLink')))

async function onRoleChange(next: string) {
  $e(isWorkspaceInvite.value ? 'c:invite:workspace:link:role:change' : 'c:invite:base:link:role:change', {
    role: next,
    existing: !!primary.value,
  })

  if (!primary.value) {
    pendingRole.value = next
    return
  }

  await saveLink(primary.value.id, { role: next })
}

/**
 * Create-then-copy in one press. The clipboard write has to stay in the same
 * task as the click for Safari, so the text is put on the clipboard before the
 * await where a link already exists.
 */
async function onCopy() {
  if (isBusy.value) return

  isBusy.value = true

  try {
    let link = primary.value
    const isFirst = !link

    if (!link) {
      link = await createLink(pendingRole.value ? { role: pendingRole.value } : undefined)

      if (link) {
        $e(isWorkspaceInvite.value ? 'a:invite:workspace:link:create' : 'a:invite:base:link:create', {
          role: link.role,
          restricted: !!link.email_domain,
        })
      }
    }

    if (!link) return

    // useCopy throws when the clipboard refuses; without this the press would
    // do nothing at all and look like a dead button.
    await copy(linkUrl(link))

    $e(isWorkspaceInvite.value ? 'c:invite:workspace:link:copy' : 'c:invite:base:link:copy', {
      created: isFirst,
      restricted: !!link.email_domain,
    })

    isCopied.value = true
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (isCopied.value = false), 2000)
  } catch (e: any) {
    message.error(e?.message || t('msg.error.copyToClipboardError'))
  } finally {
    isBusy.value = false
  }
}

onBeforeUnmount(() => clearTimeout(copiedTimer))
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-start gap-3">
      <div class="flex-1 min-w-0 text-bodyDefault font-semibold text-nc-content-gray">
        {{ $t('labels.inviteViaPrivateLink') }}
      </div>

      <!-- The count is the useful part and doubles as the way in; with no links
           there is nothing to count and nothing to manage, so it is absent. -->
      <button
        v-if="links.length"
        class="nc-hub-manage-links flex-none text-bodySm text-nc-content-gray-muted hover:text-nc-content-gray"
        data-testid="nc-hub-all-links"
        @click="emit('manage')"
      >
        {{ $t('msg.info.inviteLinkCount', { count: links.length }, links.length) }}
      </button>
    </div>

    <div class="text-bodyDefault text-nc-content-gray-subtle2 leading-relaxed">
      <span v-if="!isLoaded && isLoading" class="inline-block w-full h-4 rounded bg-nc-bg-gray-light align-middle" />

      <!-- One sentence rather than fragments, so the role control sits in the
           copy that explains it and translators can move it. Short enough to
           keep the role chip on the same line as the words it belongs to --
           the caution below carries what the sentence used to say. -->
      <i18n-t v-else :keypath="domain ? 'msg.info.inviteLinkDomainSentence' : 'msg.info.inviteLinkOpenSentence'" tag="span">
        <template #domain>
          <span class="nc-hub-domain-chip">{{ `@${domain}` }}</span>
        </template>
        <template #role>
          <RolesSelectorV2
            :on-role-change="onRoleChange"
            :role="role"
            :roles="allowedRoles"
            :disabled-roles="disabledRoles"
            :disabled-roles-tooltip="disabledRolesTooltip"
            trigger-variant="compact"
            size="sm"
            placement="bottomLeft"
          />
        </template>
      </i18n-t>
    </div>

    <!-- Only an unrestricted link needs the warning: a domain-restricted one
         already says who it will let in. -->
    <div v-if="isLoaded && !domain" class="text-bodySm text-nc-content-gray-muted">
      {{ $t('msg.info.inviteLinkOpenCaution') }}
    </div>

    <NcButton
      type="primary"
      size="medium"
      class="nc-hub-copy-cta !w-full mt-1"
      data-testid="nc-hub-copy-link"
      :loading="isBusy"
      :disabled="!isLoaded && isLoading"
      @click="onCopy"
    >
      <span class="flex items-center justify-center gap-2">
        <Transition name="nc-copy-swap" mode="out-in">
          <span v-if="isCopied" key="copied" class="flex items-center gap-2">
            <!-- An outline check: the build injects stroke="currentColor" on every
                 SVG, which turns a solid glyph into a filled blob. -->
            <GeneralIcon icon="ncCheck" class="flex-none w-4.5 h-4.5" />
            {{ $t('msg.info.inviteLinkCopied') }}
          </span>
          <span v-else key="copy" class="flex items-center gap-2">
            <GeneralIcon icon="link2" class="flex-none w-4.5 h-4.5" />
            {{ ctaLabel }}
          </span>
        </Transition>
      </span>
    </NcButton>
  </div>
</template>

<style lang="scss" scoped>
// Semantic grey tokens, so the chip follows every palette in both modes rather
// than carrying its own colour.
.nc-hub-domain-chip {
  @apply inline-block px-1.5 py-0.5 rounded-md align-middle;
  font-family: 'DM Mono', monospace;
  font-size: 0.8125rem;
  background: var(--nc-bg-gray-light);
  color: var(--nc-content-gray-subtle);
}

// Swap rather than fade: the label changes meaning, so it should read as one
// thing replacing another rather than the same thing dimming.
.nc-copy-swap-enter-active,
.nc-copy-swap-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.nc-copy-swap-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.nc-copy-swap-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .nc-copy-swap-enter-active,
  .nc-copy-swap-leave-active {
    transition: none;
  }
}
</style>
