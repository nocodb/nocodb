<script setup lang="ts">
interface Props {
  email?: string
  displayName?: string
  userMeta?: any
  /** Builder preview — renders the same banner but the action is non-interactive. */
  preview?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  email: '',
  displayName: '',
  userMeta: null,
  preview: false,
})

const emit = defineEmits<{ switch: [] }>()

const { email, displayName, userMeta, preview } = toRefs(props)

const primaryLabel = computed(() => displayName.value?.trim() || email.value)

const hasSecondary = computed(() => !!displayName.value?.trim() && !!email.value)
</script>

<template>
  <div class="nc-signed-in-banner" data-testid="nc-shared-form-signin-banner">
    <div class="nc-signed-in-banner__identity">
      <div class="nc-signed-in-banner__avatar">
        <GeneralUserIcon
          :user="{ display_name: displayName, email, meta: userMeta }"
          size="base"
          :show-placeholder-icon="!email"
        />
        <span class="nc-signed-in-banner__check">
          <GeneralIcon icon="check" class="w-2.5 h-2.5" />
        </span>
      </div>

      <div class="nc-signed-in-banner__text">
        <span class="nc-signed-in-banner__eyebrow">{{ $t('labels.signedInAs') }}</span>
        <NcTooltip class="truncate" show-on-truncate-only>
          <template #title>{{ email }}</template>
          <span class="nc-signed-in-banner__name">{{ primaryLabel }}</span>
        </NcTooltip>
        <span v-if="hasSecondary" class="nc-signed-in-banner__email">{{ email }}</span>
      </div>
    </div>

    <NcButton
      v-if="!preview"
      type="secondary"
      size="xsmall"
      class="nc-signed-in-banner__switch !rounded-lg !px-2.5"
      data-testid="nc-shared-form-switch-account"
      @click="emit('switch')"
    >
      <div class="flex items-center gap-1.5">
        <GeneralIcon icon="ncRepeat" class="w-3.5 h-3.5" />
        <span>{{ $t('msg.info.switchAccount') }}</span>
      </div>
    </NcButton>

    <span v-else class="nc-signed-in-banner__switch-preview">
      <GeneralIcon icon="ncRepeat" class="w-3.5 h-3.5" />
      {{ $t('msg.info.switchAccount') }}
    </span>
  </div>
</template>

<style lang="scss" scoped>
.nc-signed-in-banner {
  @apply flex items-center justify-between gap-3 w-full px-3 py-2.5 rounded-2xl border-1 border-nc-border-gray-medium;

  // Subtle gradient lift so the banner reads as a distinct, trustworthy surface
  // sitting above the form body without competing with it.
  background: linear-gradient(180deg, var(--nc-bg-gray-extralight) 0%, var(--nc-bg-default) 100%);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);

  &__identity {
    @apply flex items-center gap-2.5 min-w-0;
  }

  &__avatar {
    @apply relative flex-none;
  }

  &__check {
    @apply absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-3.5 h-3.5 rounded-full text-white;
    background-color: var(--nc-content-green-medium, #17803d);
    border: 1.5px solid var(--nc-bg-default);
  }

  &__text {
    @apply flex flex-col min-w-0 leading-tight;
  }

  &__eyebrow {
    @apply text-[10px] font-semibold uppercase tracking-wider text-nc-content-gray-muted;
  }

  &__name {
    @apply text-bodyDefaultSm font-semibold text-nc-content-gray-emphasis truncate;
  }

  &__email {
    @apply text-tiny text-nc-content-gray-subtle2 truncate;
  }

  &__switch {
    @apply flex-none;
  }

  &__switch-preview {
    @apply flex-none flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-bodySm font-medium text-nc-content-gray-subtle2 border-1 border-nc-border-gray-medium bg-nc-bg-default;
  }
}
</style>
