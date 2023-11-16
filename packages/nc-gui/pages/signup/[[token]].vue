<script setup lang="ts">
import { validatePassword } from 'nocodb-sdk'
import type { RuleObject } from 'ant-design-vue/es/form'
import {
  definePageMeta,
  navigateTo,
  reactive,
  ref,
  useApi,
  useGlobal,
  useI18n,
  useNuxtApp,
  useRoute,
  validateEmail,
} from '#imports'

definePageMeta({
  requiresAuth: false,
})

const { $e } = useNuxtApp()

const route = useRoute()

const { appInfo, signIn } = useGlobal()

const { api, isLoading, error } = useApi({ useGlobalInstance: true })

const { t } = useI18n()

const { navigateToTable } = useTablesStore()

const { clearWorkspaces } = useWorkspace()

const formValidator = ref()

const subscribe = ref(false)

const form = reactive({
  email: '',
  password: '',
})

const formRules = {
  email: [
    // E-mail is required
    { required: true, message: t('msg.error.signUpRules.emailReqd') },
    // E-mail must be valid format
    {
      validator: (_: unknown, v: string) => {
        return new Promise((resolve, reject) => {
          if (!v?.length || validateEmail(v)) return resolve()
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

  api.auth.signup(data).then(async (user) => {
    signIn(user.token!)

    $e('a:auth:sign-up')

    try {
      // TODO: Add to swagger
      const base = (user as any).createdProject
      const table = base?.tables?.[0]

      if (base && table) {
        return await navigateToTable({
          baseId: base.id,
          tableId: table.id,
          workspaceId: 'nc',
        })
      }
    } catch (e) {
      console.error(e)
    }

    await navigateTo({
      path: '/',
      query: route.query,
    })
  })
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
    <div class="md:bg-primary bg-opacity-5 signup h-full min-h-[600px] flex flex-col justify-center items-center">
      <div
        class="bg-white mt-[60px] relative flex flex-col justify-center gap-2 w-full max-w-[500px] mx-auto p-8 md:(rounded-lg border-1 border-gray-200 shadow-xl)"
      >
        <LazyGeneralNocoIcon class="color-transition hover:(ring ring-accent ring-opacity-100)" :animate="isLoading" />

        <h1 class="prose-2xl font-bold self-center my-4">
          {{ $t('general.signUp') }}
          {{ $route.query.redirect_to === '/referral' ? '& REFER' : '' }}
          {{ $route.query.redirect_to === '/pricing' ? '& BUY' : '' }}
        </h1>

        <h2 v-if="appInfo.firstUser" class="prose !text-primary font-semibold self-center">
          {{ $t('msg.info.signUp.superAdmin') }}
        </h2>

        <a-form ref="formValidator" :model="form" layout="vertical" no-style @finish="signUp">
          <template v-if="!appInfo.disableEmailAuth">
            <Transition name="layout">
              <div
                v-if="error"
                class="self-center mb-4 bg-red-500 text-white rounded-lg w-3/4 mx-auto p-1"
                data-testid="nc-signup-error"
              >
                <div class="flex items-center gap-2 justify-center">
                  <MaterialSymbolsWarning />
                  <div class="break-words">{{ error }}</div>
                </div>
              </div>
            </Transition>

            <a-form-item :label="$t('labels.email')" name="email" :rules="formRules.email">
              <a-input
                v-model:value="form.email"
                size="large"
                :placeholder="$t('msg.info.signUp.workEmail')"
                @focus="resetError"
              />
            </a-form-item>

            <a-form-item :label="$t('labels.password')" name="password" :rules="formRules.password">
              <a-input-password
                v-model:value="form.password"
                size="large"
                class="password"
                :placeholder="$t('msg.info.signUp.enterPassword')"
                @focus="resetError"
              />
            </a-form-item>
          </template>
          <div class="self-center flex flex-col flex-wrap gap-4 items-center mt-4">
            <template v-if="!appInfo.disableEmailAuth">
              <button class="scaling-btn bg-opacity-100" type="submit">
                <span class="flex items-center gap-2">
                  <MaterialSymbolsRocketLaunchOutline />

                  {{ $t('general.signUp') }}
                </span>
              </button>
            </template>
            <a
              v-if="appInfo.googleAuthEnabled"
              :href="`${appInfo.ncSiteUrl}/auth/google`"
              class="scaling-btn bg-opacity-100 after:(!bg-white) !text-primary !no-underline"
            >
              <span class="flex items-center gap-2">
                <LogosGoogleGmail />

                {{ $t('labels.signUpWithProvider', { provider: 'Google' }) }}
              </span>
            </a>

            <div
              v-if="appInfo.oidcAuthEnabled"
              class="self-center flex flex-col flex-wrap gap-4 items-center mt-4 justify-center"
            >
              <a :href="`${appInfo.ncSiteUrl}/auth/oidc`" class="!text-primary !no-underline">
                <button type="button" class="scaling-btn bg-opacity-100">
                  <span class="flex items-center gap-2">
                    <MdiLogin />
                    <template v-if="!appInfo.disableEmailAuth">
                      {{ $t('labels.signUpWithProvider', { provider: appInfo.oidcProviderName || 'OpenID Connect' }) }}
                    </template>
                    <template v-else>
                      {{ $t('general.signUp') }}
                    </template>
                  </span>
                </button>
              </a>
            </div>

            <div v-if="!appInfo.disableEmailAuth" class="flex items-center gap-2">
              <a-switch
                v-model:checked="subscribe"
                size="small"
                class="my-1 hover:(ring ring-accent ring-opacity-100) focus:(!ring !ring-accent ring-opacity-100)"
              />
              <div class="prose-xs text-gray-500">{{ $t('msg.subscribeToOurWeeklyNewsletter') }}</div>
            </div>

            <div class="text-end prose-sm">
              {{ $t('msg.info.signUp.alreadyHaveAccount') }}

              <nuxt-link @click="navigateSignIn">{{ $t('general.signIn') }}</nuxt-link>
            </div>
          </div>
        </a-form>
      </div>

      <div class="prose-sm mt-4 text-gray-500">
        {{ $t('msg.bySigningUp') }}
        <a class="prose-sm !text-gray-500 underline" target="_blank" href="https://nocodb.com/policy-nocodb" rel="noopener">
          {{ $t('title.termsOfService') }}</a
        >
      </div>
    </div>
  </NuxtLayout>
</template>

<style lang="scss">
.signup {
  .ant-input-affix-wrapper,
  .ant-input {
    @apply !appearance-none my-1 border-1 border-solid border-primary border-opacity-50 rounded;
  }

  .password {
    input {
      @apply !border-none !m-0;
    }
  }
}
</style>
