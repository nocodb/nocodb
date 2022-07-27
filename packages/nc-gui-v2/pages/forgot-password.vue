<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { definePageMeta } from '#imports'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import { useNuxtApp } from '#app'
import { isEmail } from '~/utils/validation'
import MdiLogin from '~icons/mdi/login'
import MaterialSymbolsWarning from '~icons/material-symbols/warning'
import ClaritySuccessLine from '~icons/clarity/success-line'

const { $api } = $(useNuxtApp())

const { t } = useI18n()

definePageMeta({
  requiresAuth: false,
  title: 'title.resetPassword',
})

let error = $ref<string | null>(null)
let success = $ref(false)

const formValidator = ref()

const form = reactive({
  email: '',
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
}

const resetPassword = async () => {
  const valid = formValidator.value.validate()
  if (!valid) return

  error = null
  try {
    await $api.auth.passwordForgot(form)
    success = true
  } catch (e: any) {
    // todo: errors should not expose what was wrong (i.e. do not show "Password is wrong" messages)
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
      layout="vertical"
      :model="form"
      class="forgot-password h-full min-h-[600px] flex justify-center items-center"
      @finish="resetPassword"
    >
      <div class="h-full w-full flex flex-col flex-wrap justify-center items-center">
        <div
          class="color-transition bg-white dark:(!bg-gray-900 !text-white) relative flex flex-col justify-center gap-2 w-full max-w-[500px] mx-auto p-8 md:(rounded-lg border-1 border-gray-200 shadow-xl)"
        >
          <general-noco-icon />

          <div class="self-center flex flex-col justify-center items-center text-center gap-4">
            <h1 class="prose-2xl font-bold my-4 w-full">{{ $t('title.resetPassword') }}</h1>

            <template v-if="!success">
              <p class="prose-sm">{{ $t('msg.info.passwordRecovery.message_1') }}</p>
              <p class="prose-sm mb-4">{{ $t('msg.info.passwordRecovery.message_2') }}</p>
            </template>
            <template v-else>
              <p class="prose-sm text-success flex items-center leading-8 gap-2">
                {{ $t('msg.info.passwordRecovery.success') }} <ClaritySuccessLine />
              </p>

              <nuxt-link to="/signin">{{ $t('general.signIn') }}</nuxt-link>
            </template>
          </div>

          <Transition name="layout">
            <div v-if="error" class="self-center mb-4 bg-red-500 text-white rounded-lg w-3/4 p-1">
              <div class="flex items-center gap-2 justify-center"><MaterialSymbolsWarning /> {{ error }}</div>
            </div>
          </Transition>

          <a-form-item :label="$t('labels.email')" name="email" :rules="formRules.email">
            <a-input v-model:value="form.email" size="large" :placeholder="$t('labels.email')" @focus="resetError" />
          </a-form-item>

          <div class="self-center flex flex-wrap gap-4 items-center mt-4 md:mx-8 md:justify-between justify-center w-full">
            <button class="submit" type="submit">
              <span class="flex items-center gap-2"><MdiLogin /> {{ $t('activity.sendEmail') }}</span>
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
.forgot-password {
  .ant-input-affix-wrapper,
  .ant-input {
    @apply dark:(bg-gray-700 !text-white) !appearance-none my-1 border-1 border-solid border-primary/50 rounded;
  }

  .submit {
    @apply ml-1 border border-gray-300 rounded-lg p-4 bg-gray-100/50 text-white bg-primary hover:bg-primary/75 dark:(!bg-secondary/75 hover:!bg-secondary/50);
  }
}
</style>
