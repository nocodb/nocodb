<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import { navigateTo } from '#app'
import { isEmail } from '~/utils/validation'
import MaterialSymbolsWarning from '~icons/material-symbols/warning'
import MaterialSymbolsRocketLaunchOutline from '~icons/material-symbols/rocket-launch-outline'

const { $api, $state } = useNuxtApp()

const { t } = useI18n()

definePageMeta({
  requiresAuth: false,
})

const formValidator = ref()
let error = $ref<string | null>(null)

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
          if (isEmail(v)) return resolve(true)
          reject(new Error(t('msg.error.signUpRules.emailInvalid')))
        })
      },
      message: t('msg.error.signUpRules.emailInvalid'),
    },
  ],
  password: [
    // Password is required
    { required: true, message: t('msg.error.signUpRules.passwdRequired') },
    { min: 8, message: t('msg.error.signUpRules.passwdLength') },
  ],
}

const signUp = async () => {
  const valid = formValidator.value.validate()
  if (!valid) return

  error = null
  try {
    const { token } = await $api.auth.signup(form)
    $state.signIn(token!)
    await navigateTo('/')
  } catch (e: any) {
    error = await extractSdkResponseErrorMsg(e)
  }
}

const resetError = () => {
  if (error) {
    error = null
  }
}
</script>

<template>
  <NuxtLayout>
    <a-form
      ref="formValidator"
      :model="form"
      layout="vertical"
      class="signup h-[calc(100%_+_90px)] min-h-[600px] flex justify-center items-center nc-form-signup"
      @finish="signUp"
    >
      <div class="h-full w-full flex flex-col flex-wrap pt-[100px]">
        <div
          class="bg-white dark:(!bg-gray-900 !text-white) relative flex flex-col justify-center gap-2 w-full max-w-[500px] mx-auto p-8 md:(rounded-lg border-1 border-gray-200 shadow-xl)"
        >
          <general-noco-icon />

          <h1 class="prose-2xl font-bold self-center my-4">{{ $t('general.signUp') }}</h1>

          <Transition name="layout">
            <div v-if="error" class="self-center mb-4 bg-red-500 text-white rounded-lg w-3/4 p-1">
              <div class="flex items-center gap-2 justify-center"><MaterialSymbolsWarning /> {{ error }}</div>
            </div>
          </Transition>

          <a-form-item :label="$t('labels.email')" name="email" :rules="formRules.email">
            <a-input v-model:value="form.email" size="large" :placeholder="$t('labels.email')" @focus="resetError" />
          </a-form-item>

          <a-form-item :label="$t('labels.password')" name="password" :rules="formRules.password">
            <a-input-password
              v-model:value="form.password"
              size="large"
              class="password"
              :placeholder="$t('labels.password')"
              @focus="resetError"
            />
          </a-form-item>

          <div
            class="self-center flex flex-column flex-wrap gap-4 items-center mt-4 md:mx-8 md:justify-between justify-center w-full"
          >
            <button class="submit" type="submit">
              <span class="flex items-center gap-2"><MaterialSymbolsRocketLaunchOutline /> {{ $t('general.signUp') }}</span>
            </button>
            <div class="text-end prose-sm">
              {{ $t('msg.info.signUp.alreadyHaveAccount') }}
              <nuxt-link to="/signin">{{ $t('general.signIn') }}</nuxt-link>
            </div>
          </div>
        </div>
      </div>
    </a-form>
  </NuxtLayout>
</template>

<style lang="scss">
.signup {
  .ant-input-affix-wrapper,
  .ant-input {
    @apply dark:(bg-gray-700 !text-white) !appearance-none my-1 border-1 border-solid border-primary/50 rounded;
  }

  .password {
    input {
      @apply !border-none;
    }

    .ant-input-password-icon {
      @apply dark:!text-white;
    }
  }

  .submit {
    @apply ml-1 border border-gray-300 rounded-lg p-4 bg-gray-100/50 text-white bg-primary hover:bg-primary/75 dark:(!bg-secondary/75 hover:!bg-secondary/50);
  }
}
</style>
