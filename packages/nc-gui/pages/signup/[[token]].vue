<script setup lang="ts">
import { validatePassword } from 'nocodb-sdk'
import type { RuleObject } from 'ant-design-vue/es/form'

definePageMeta({
  requiresAuth: false,
})

const { $e } = useNuxtApp()

const route = useRoute()

const { appInfo, signIn } = useGlobal()

const { productName } = useBranding()

const { selectMethod } = useAuthLastMethod()

const { api, isLoading, error } = useApi({ useGlobalInstance: true })

const { t } = useI18n()

const { isEnabledOnboardingFlow, showOnboardingFlowLocalState } = useOnboardingFlow()

const { clearWorkspaces } = useWorkspace()

const formValidator = ref()

const subscribe = ref(false)

const form = reactive({
  email: '',
  password: '',
})

const hasProviders = computed(() => !!appInfo.value.googleAuthEnabled || !!appInfo.value.oidcAuthEnabled)

const formRules = {
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
  ] as RuleObject[],
  password: [
    {
      validator: (_: unknown, v: string) => {
        return new Promise((resolve, reject) => {
          const { error, valid } = validatePassword(v)
          if (valid) return resolve()
          reject(new Error(error))
        })
      },
    },
  ] as RuleObject[],
}

async function signUp() {
  if (!formValidator.value.validate()) return

  resetError()

  const data: any = {
    ...form,
    token: route.params.token,
  }

  data.ignore_subscribe = !subscribe.value

  api.auth.signup(data).then(
    async (user) => {
      commitAuthMethod('email')
      signIn(user.token!)

      $e('a:auth:sign-up')

      try {
        // TODO: Add to swagger
        if (isEnabledOnboardingFlow.value) {
          const continueAfterOnboardingFlow = 'nc'

          /**
           * Onboarding flow is shown only for new users
           */
          showOnboardingFlowLocalState.value = true

          await navigateTo({
            path: '/',
            query: continueAfterOnboardingFlow ? { continueAfterOnboardingFlow } : {},
          })

          return
        }

        // if user signed up then redirect to ws bases list page
        return await navigateTo({
          name: 'index-typeOrId',
          params: {
            typeOrId: 'nc',
          },
        })
      } catch (e) {
        console.error(e)
      }

      if (isEnabledOnboardingFlow.value) {
        /**
         * Onboarding flow is shown only for new users
         */
        showOnboardingFlowLocalState.value = true
        await navigateTo('/')
        return
      }

      await navigateTo({
        path: '/',
        query: route.query,
      })
    },
    () => $e('a:auth:sign-up:error', { method: 'email' }),
  )
}

function resetError() {
  if (error.value) error.value = null
}

function navigateSignIn() {
  navigateTo({
    path: '/signin',
    query: route.query,
  })
}

onMounted(async () => {
  await clearWorkspaces()
})
</script>

<template>
  <NuxtLayout>
    <AuthShell class="nc-form-signup" :title="$t('labels.auth.signUpTitle', { product: productName })" :loading="isLoading">
      <template #subtitle>
        <span v-if="appInfo.firstUser" class="text-nc-content-brand">{{ $t('msg.info.signUp.superAdmin') }}</span>
        <template v-else>{{ $t('labels.auth.signUpSubtitle') }}</template>
      </template>

      <div v-if="hasProviders" class="flex flex-col gap-2">
        <a
          v-if="appInfo.googleAuthEnabled"
          :href="`${appInfo.ncSiteUrl}/auth/google`"
          class="nc-auth-provider"
          @click="selectMethod('google', 'signup')"
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
          @click="selectMethod('oidc', 'signup')"
        >
          <NcButton type="secondary" class="w-full">
            <template #icon>
              <MdiLogin />
            </template>
            <template v-if="!appInfo.disableEmailAuth">
              {{ $t('labels.continueWithProvider', { provider: appInfo.oidcProviderName || 'OpenID Connect' }) }}
            </template>
            <template v-else>{{ $t('labels.auth.signUp') }}</template>
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

      <a-form v-if="!appInfo.disableEmailAuth" ref="formValidator" :model="form" layout="vertical" no-style @finish="signUp">
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
            data-testid="nc-form-signup__email"
            :placeholder="$t('labels.auth.emailPlaceholder')"
            @focus="resetError"
          />
        </a-form-item>

        <a-form-item :label="$t('labels.auth.password')" name="password" :rules="formRules.password">
          <a-input-password
            v-model:value="form.password"
            autocomplete="new-password"
            data-testid="nc-form-signup__password"
            :placeholder="$t('labels.auth.passwordPlaceholder')"
            @focus="resetError"
          />
        </a-form-item>

        <div class="flex items-center gap-2">
          <a-switch v-model:checked="subscribe" size="small" />
          <span class="text-bodySm text-nc-content-gray-subtle">{{ $t('msg.subscribeToOurWeeklyNewsletter') }}</span>
        </div>

        <AuthSubmitButton
          data-testid="nc-form-signup__submit"
          html-type="submit"
          :error="error"
          error-testid="nc-signup-error"
          :loading="isLoading"
        >
          {{ $t('labels.auth.signUp') }}
        </AuthSubmitButton>
      </a-form>

      <div class="mt-4 text-center lg:text-left text-bodySm text-nc-content-gray-muted">
        {{ $t('msg.bySigningUp') }}
        <a class="nc-auth-link" target="_blank" href="https://nocodb.com/policy-nocodb" rel="noopener">{{
          $t('title.termsOfService')
        }}</a>
      </div>

      <template #footer>
        {{ $t('labels.auth.haveAccount') }}
        <a class="nc-auth-link" @click="navigateSignIn">{{ $t('labels.auth.signIn') }}</a>
      </template>
    </AuthShell>
  </NuxtLayout>
</template>
