<script setup lang="ts">
import { useSsoError } from '~/composables/useSsoError'

const props = defineProps<{
  title?: string
  message?: string
  /** Failure bucket, paired with errorRef so support can find the matching log line. */
  code?: string
  errorRef?: string
}>()

const { clearError } = useSsoError()

const route = useRoute()

const supportCode = computed(() => [props.code, props.errorRef].filter(Boolean).join(' · '))

const handleRetry = () => {
  clearError()
  // on /sso, clearing alone would only re-show the SSO email form
  if (route.path.startsWith('/sso')) navigateTo('/signin')
}
</script>

<template>
  <AuthShell :title="title || $t('msg.noAccess')" data-testid="nc-sso-error-title">
    <template #subtitle>
      <span data-testid="nc-sso-error-message">{{ message || $t('msg.noAccessDescription') }}</span>
    </template>

    <NcButton type="primary" class="nc-auth-primary w-full" data-testid="nc-sso-error-retry" @click="handleRetry">
      {{ $t('labels.auth.backToSignIn') }}
    </NcButton>

    <template v-if="supportCode" #footer>
      <div class="flex flex-col gap-1">
        <span class="text-captionSm">{{ $t('msg.sso.shareCode') }}</span>
        <div class="flex items-center gap-2 text-caption">
          <i18n-t keypath="labels.auth.reference" tag="span" class="min-w-0 break-all">
            <template #ref>
              <span class="font-mono" data-testid="nc-sso-error-code">{{ supportCode }}</span>
            </template>
          </i18n-t>
          <GeneralCopyButton :content="supportCode" data-testid="nc-sso-error-copy" />
        </div>
      </div>
    </template>
  </AuthShell>
</template>
