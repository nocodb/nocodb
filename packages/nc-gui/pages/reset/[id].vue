<script setup lang="ts">
import { validatePassword } from 'nocodb-sdk'

definePageMeta({
  requiresAuth: false,
})

const { api, isLoading, error } = useApi()

const { t } = useI18n()

const route = useRoute()
const navigator = useRouter()

const form = reactive({
  password: '',
  newPassword: '',
})

const formValidator = ref()

async function resetPassword() {
  if (form.newPassword !== form.password) {
    error.value = 'password does not match'
    return
  }
  const { error: mesg, valid } = validatePassword(form.password)

  if (!valid) {
    error.value = mesg.includes('8') ? 'password should be atleast 8 characters' : mesg
    return
  }

  resetError()

  try {
    await api.auth.passwordReset(route.params.id as string, {
      password: form.password,
    })
    navigator.push(`/#/sigin`)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

function resetError() {
  if (error.value) error.value = null
}
</script>

<template>
  <div>
    <NuxtLayout>
      <div
        class="md:bg-primary signin bg-opacity-5 forgot-password h-full min-h-[600px] flex flex-col justify-center items-center"
      >
        <div
          class="bg-white mt-[60px] relative flex flex-col justify-center gap-2 w-full max-w-[500px] mx-auto p-8 md:(rounded-lg border-1 border-gray-200 shadow-xl)"
        >
          <LazyGeneralNocoIcon class="color-transition hover:(ring ring-accent ring-opacity-100)" :animate="isLoading" />

          <div class="self-center flex flex-col justify-center items-center text-center gap-2">
            <h1 class="prose-2xl font-bold my-4 w-full">{{ $t('title.resetPassword') }}</h1>

            <div class="prose-sm text-success flex items-center leading-8 gap-2">
              {{ $t('msg.info.passwordRecovery.success') }} <ClaritySuccessLine />
            </div>

            <nuxt-link to="/signin">{{ $t('general.signIn') }}</nuxt-link>
          </div>

          <a-form ref="formValidator" layout="vertical" :model="form" no-style @finish="resetPassword">
            <Transition name="layout">
              <div v-if="error" class="self-center mb-4 bg-red-500 text-white rounded-lg w-3/4 mx-auto p-1">
                <div class="flex items-center gap-2 justify-center">
                  <MaterialSymbolsWarning />
                  <div class="break-words">{{ error }}</div>
                </div>
              </div>
            </Transition>

            <a-form-item
              :label="$t('placeholder.password.new')"
              name="password"
              :rules="[{ required: true, message: t('msg.error.signUpRules.passwdRequired') }]"
            >
              <a-input-password
                v-model:value="form.password"
                :placeholder="$t('placeholder.password.new')"
                class="password"
                @focus="resetError"
              />
            </a-form-item>

            <a-form-item
              :label="$t('placeholder.password.confirm')"
              name="newPassword"
              :rules="[{ required: true, message: t('msg.error.signUpRules.passwdRequired') }]"
            >
              <a-input-password
                v-model:value="form.newPassword"
                type="password"
                class="password"
                :placeholder="$t('placeholder.password.confirm')"
                @focus="resetError"
              />
            </a-form-item>

            <div class="self-center flex flex-col gap-4 items-center justify-center w-full">
              <NcButton type="primary" :is-loading="isLoading" html-type="submit">
                <span class="flex items-center gap-2">
                  <component :is="iconMap.signin" />
                  {{ $t('general.reset') }}
                </span>
              </NcButton>
            </div>
          </a-form>
        </div>
      </div>
    </NuxtLayout>
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
