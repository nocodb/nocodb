<script setup lang="ts">
import type { RuleObject } from 'ant-design-vue/es/form'
import type { Api } from 'nocodb-sdk'

const { api, isLoading, error } = useApi({ useGlobalInstance: true })

const { t } = useI18n()

const router = useRouter()
const route = router.currentRoute

const { appInfo } = useGlobal()

useSidebar('nc-left-sidebar', { hasSidebar: false })

const formValidator = ref()

const form = reactive({
  email: '',
})

watch(
  () => route.value.query?.error,
  async (errorStr) => {
    if (errorStr) {
      await router.replace({ query: { error: undefined } })
      error.value = errorStr
    }
  },
  { immediate: true },
)

const formRules: Record<string, RuleObject[]> = {
  email: [
    // E-mail is required
    { required: true, message: t('msg.error.signUpRules.emailRequired') },
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
  ],
  password: [
    // Password is required
    { required: true, message: t('msg.error.signUpRules.passwdRequired') },
  ],
}

const clients = ref<any[]>(null)

async function getSsoClients() {
  try {
    if (!formValidator.value.validate()) return

    resetError()
    clients.value = await (api as Api<any>).orgSsoClient.getByEmail(form)

    if (clients.value?.length === 1) {
      location.href = clients.value[0].url
    }
  } catch {
    // ignore since error is already set in composable
  }
}

function resetError() {
  if (error.value) error.value = null
}
</script>

<template>
  <div
    data-testid="nc-form-signin"
    class="md:bg-primary bg-opacity-5 signin h-full min-h-[600px] flex flex-col justify-center items-center nc-form-signin"
  >
    <template v-if="!appInfo.isCloud">
      <div
        v-for="client of appInfo.ssoClients || []"
        :key="client.id"
        class="self-center flex flex-col flex-wrap gap-4 items-center mt-4 justify-center"
      >
        <a
          v-if="client.type === 'google'"
          :href="client.url"
          class="scaling-btn bg-opacity-100 after:(!bg-white) !text-primary !no-underline"
        >
          <span class="flex items-center gap-2">
            <LogosGoogleGmail />
            {{ $t('labels.signInWithProvider', { provider: 'Google' }) }}
          </span>
        </a>

        <a v-else :href="client.url" class="!text-primary !no-underline">
          <button type="button" class="scaling-btn bg-opacity-100">
            <span class="flex items-center gap-2">
              <MdiLogin />
              {{ $t('labels.signInWithProvider', { provider: client.title || client.type.toUpperCase() }) }}
            </span>
          </button>
        </a>
      </div>

      <Transition name="layout">
        <div v-if="error" class="self-center mb-4 bg-red-500 text-white rounded-lg w-3/4 mx-auto p-1 max-w-150 mt-5">
          <div class="flex items-center gap-2 justify-center">
            <MaterialSymbolsWarning />
            <div class="break-words">{{ error }}</div>
          </div>
        </div>
      </Transition>
    </template>

    <template v-else-if="clients && clients.length > 1">
      <div
        v-for="client of clients || []"
        :key="client.id"
        class="self-center flex flex-col flex-wrap gap-4 items-center mt-4 justify-center"
      >
        <a
          v-if="client.type === 'google'"
          :href="client.url"
          class="scaling-btn bg-opacity-100 after:(!bg-white) !text-primary !no-underline"
        >
          <span class="flex items-center gap-2">
            <LogosGoogleGmail />

            {{ $t('labels.signInWithProvider', { provider: 'Google' }) }}
          </span>
        </a>

        <a v-else :href="client.url" class="!text-primary !no-underline">
          <button type="button" class="scaling-btn bg-opacity-100">
            <span class="flex items-center gap-2">
              <MdiLogin />
              {{ $t('labels.signInWithProvider', { provider: client.title || client.type.toUpperCase() }) }}
            </span>
          </button>
        </a>
      </div>

      <Transition name="layout">
        <div v-if="error" class="self-center mb-4 bg-red-500 text-white rounded-lg w-3/4 mx-auto p-1 max-w-150 mt-5">
          <div class="flex items-center gap-2 justify-center">
            <MaterialSymbolsWarning />
            <div class="break-words">{{ error }}</div>
          </div>
        </div>
      </Transition>
    </template>

    <div
      v-else
      class="bg-white mt-[60px] relative flex flex-col justify-center gap-2 w-full max-w-[500px] mx-auto p-8 md:(rounded-lg border-1 border-gray-200 shadow-xl)"
    >
      <LazyGeneralNocoIcon class="color-transition hover:(ring ring-accent ring-opacity-100)" :animate="isLoading" />

      <h1 class="prose-2xl font-bold self-center my-4">{{ $t('general.signIn') }}</h1>

      <a-form ref="formValidator" :model="form" layout="vertical" no-style @finish="getSsoClients">
        <Transition name="layout">
          <div v-if="error" class="self-center mb-4 bg-red-500 text-white rounded-lg w-3/4 mx-auto p-1">
            <div class="flex items-center gap-2 justify-center">
              <MaterialSymbolsWarning />
              <div class="break-words">{{ error }}</div>
            </div>
          </div>
        </Transition>

        <a-form-item :label="$t('labels.email')" name="email" :rules="formRules.email">
          <a-input
            v-model:value="form.email"
            type="email"
            autocomplete="email"
            data-testid="nc-form-org-sso-signin__email"
            size="large"
            :placeholder="$t('msg.info.signUp.workEmail')"
            @focus="resetError"
          />
        </a-form-item>

        <div class="self-center flex flex-col flex-wrap gap-4 items-center mt-4 justify-center">
          <button data-testid="nc-form-signin__submit" class="scaling-btn bg-opacity-100" type="submit">
            <span class="flex items-center gap-2">
              <component :is="iconMap.signin" />
              {{ $t('general.signIn') }}
            </span>
          </button>
        </div>
      </a-form>
    </div>
  </div>
</template>

<style lang="scss">
.signin {
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
