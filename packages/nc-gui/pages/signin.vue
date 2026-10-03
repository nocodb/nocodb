<script setup lang="ts">
import type { RuleObject } from 'ant-design-vue/es/form'

definePageMeta({
  requiresAuth: false,
  title: 'title.headLogin',
})

const route = useRoute()

const { signIn: _signIn, appInfo } = useGlobal()

const { productName } = useBranding()

const { lastMethod, isLastUsed, selectMethod } = useAuthLastMethod()

const { $e } = useNuxtApp()

const { api, isLoading, error } = useApi({ useGlobalInstance: true })

const { t } = useI18n()

useSidebar('nc-left-sidebar', { hasSidebar: false })

const formValidator = ref()

const form = reactive({
  email: '',
  password: '',
})

const formRules: Record<string, RuleObject[]> = {
  email: [
    // E-mail is required
    { required: true, message: t('msg.error.signUpRules.emailRequired') },
    // E-mail must be valid format
    {
      validator: (_: unknown, v: string) => {
        return new Promise((resolve, reject) => {
          if (!v?.length || validateEmail(v.trim())) return resolve()

          reject(new Error(t('msg.error.signUpRules.emailInvalid')))
        })
      },
      message: t('msg.error.signUpRules.emailInvalid'),
    },
  ],
  password: [
    // Password is required
    { required: true, message: t('msg.error.signUpRules.passwdRequired') },
  ],
}

async function signIn() {
  if (!formValidator.value.validate()) return

  resetError()

  const wasLastUsed = isLastUsed('email')

  api.auth.signin(form).then(
    async ({ token }) => {
      lastMethod.value = 'email'
      _signIn(token!)

      $e('a:auth:sign-in:success', { method: 'email', twoFactor: false, lastUsed: wasLastUsed })

      await navigateTo({
        path: '/',
        query: route.query,
      })
    },
    () => $e('a:auth:sign-in:error', { method: 'email' }),
  )
}

function resetError() {
  if (error.value) error.value = null
}

function navigateSignUp() {
  navigateTo({
    path: '/signup',
    query: route.query,
  })
}

function navigateForgotPassword() {
  navigateTo({
    path: '/forgot-password',
    query: route.query,
  })
}

const hasProviders = computed(() => !!appInfo.value.googleAuthEnabled || !!appInfo.value.oidcAuthEnabled)
</script>

<template>
  <NuxtLayout>
    <AuthShell
      data-testid="nc-form-signin"
      class="signin nc-form-signin"
      :title="$t('labels.auth.signInTitle', { product: productName })"
      :subtitle="$t('labels.auth.signInSubtitle')"
      :loading="isLoading"
    >
      <div v-if="hasProviders" class="flex flex-col gap-2">
        <a
          v-if="appInfo.googleAuthEnabled"
          :href="`${appInfo.ncSiteUrl}/auth/google`"
          class="nc-auth-provider"
          @click="selectMethod('google', 'signin')"
        >
          <NcButton type="secondary" class="w-full">
            <template #icon>
              <LogosGoogleIcon class="w-4 h-4" />
            </template>
            {{ $t('labels.continueWithProvider', { provider: 'Google' }) }}
          </NcButton>
          <AuthLastUsedBadge method="google" class="nc-auth-provider-badge" />
        </a>

        <a
          v-if="appInfo.oidcAuthEnabled"
          :href="`${appInfo.ncSiteUrl}/auth/oidc`"
          class="nc-auth-provider"
          @click="selectMethod('oidc', 'signin')"
        >
          <NcButton type="secondary" class="w-full">
            <template #icon>
              <MdiLogin />
            </template>
            <template v-if="!appInfo.disableEmailAuth">
              {{ $t('labels.continueWithProvider', { provider: appInfo.oidcProviderName || 'OpenID Connect' }) }}
            </template>
            <template v-else>{{ $t('labels.auth.signIn') }}</template>
          </NcButton>
          <AuthLastUsedBadge method="oidc" class="nc-auth-provider-badge" />
        </a>
      </div>

      <div
        v-if="hasProviders && !appInfo.disableEmailAuth"
        class="flex items-center gap-3 my-6 text-captionSm text-nc-content-gray-muted"
      >
        <span class="flex-1 h-px bg-nc-border-gray-medium" />
        {{ $t('labels.auth.or') }}
        <span class="flex-1 h-px bg-nc-border-gray-medium" />
      </div>

      <a-form v-if="!appInfo.disableEmailAuth" ref="formValidator" :model="form" layout="vertical" no-style @finish="signIn">
        <a-form-item name="email" :rules="formRules.email">
          <template #label>
            <span class="flex items-center gap-2">
              {{ $t('labels.auth.email') }}
              <AuthLastUsedBadge method="email" />
            </span>
          </template>
          <a-input
            v-model:value="form.email"
            type="email"
            autocomplete="email"
            data-testid="nc-form-signin__email"
            :placeholder="$t('labels.auth.emailPlaceholder')"
            @focus="resetError"
          />
        </a-form-item>

        <a-form-item name="password" :rules="formRules.password">
          <template #label>
            <div class="w-full flex items-center justify-between">
              {{ $t('labels.auth.password') }}
              <a class="nc-auth-link !text-caption" tabindex="-1" @click="navigateForgotPassword">
                {{ $t('labels.auth.forgotPassword') }}
              </a>
            </div>
          </template>
          <a-input-password
            v-model:value="form.password"
            autocomplete="current-password"
            data-testid="nc-form-signin__password"
            :placeholder="$t('labels.auth.passwordPlaceholder')"
            @focus="resetError"
          />
        </a-form-item>

        <AuthSubmitButton
          data-testid="nc-form-signin__submit"
          html-type="submit"
          :error="error"
          error-testid="nc-signin-error"
          :loading="isLoading"
        >
          {{ $t('labels.auth.signIn') }}
        </AuthSubmitButton>
      </a-form>

      <template v-if="!appInfo.inviteOnlySignup" #footer>
        {{ $t('labels.auth.noAccount') }}
        <a class="nc-auth-link" @click="navigateSignUp">{{ $t('labels.auth.signUp') }}</a>
      </template>
    </AuthShell>
  </NuxtLayout>
</template>

<style lang="scss" scoped>
// the label row hosts the forgot-password link, so it must span the field
:deep(.ant-form-item-label > label) {
  @apply w-full;
}
</style>
