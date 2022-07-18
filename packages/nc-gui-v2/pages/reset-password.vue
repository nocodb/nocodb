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

const valid = ref()

const formValidator = ref()

const form = reactive({
  email: '',
})

const formRules = {
  email: [
    // E-mail is required
    (v: string) => !!v || t('msg.error.signUpRules.emailReqd'),
    // E-mail must be valid format
    (v: string) => isEmail(v) || t('msg.error.signUpRules.emailInvalid'),
  ],
}

const resetPassword = async () => {
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
    <v-form
      ref="formValidator"
      v-model="valid"
      class="h-full min-h-[600px] flex justify-center items-center"
      @submit.prevent="resetPassword"
    >
      <div class="h-full w-full flex flex-col flex-wrap justify-center items-center">
        <div
          class="color-transition bg-white dark:(!bg-gray-900 !text-white) md:relative flex flex-col justify-center gap-2 w-full max-w-[500px] mx-auto p-8 md:(rounded-lg border-1 border-gray-200 shadow-xl)"
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

          <v-text-field
            id="email"
            v-model="form.email"
            class="bg-white dark:!bg-gray-900"
            :rules="formRules.email"
            :label="$t('labels.email')"
            :placeholder="$t('labels.email')"
            :persistent-placeholder="true"
            type="text"
            @focus="resetError"
          />

          <div class="self-center flex flex-wrap gap-4 items-center mt-4 md:mx-8 md:justify-between justify-center w-full">
            <button
              :disabled="!valid"
              :class="[
                !valid
                  ? '!opacity-50 !cursor-default'
                  : 'text-white bg-primary hover:(text-primary !bg-primary/75) dark:(!bg-secondary/75 hover:!bg-secondary/50)',
              ]"
              class="ml-1 border-1 border-solid border-gray-300 color-transition rounded-lg p-4 bg-gray-100/50"
              type="submit"
            >
              <span class="flex items-center gap-2"><MdiLogin /> Reset Password</span>
            </button>
            <div class="text-end prose-sm">
              {{ $t('msg.info.signUp.alreadyHaveAccount') }}
              <nuxt-link to="/signin">{{ $t('general.signIn') }}</nuxt-link>
            </div>
          </div>
        </div>
      </div>
    </v-form>
  </NuxtLayout>
</template>
