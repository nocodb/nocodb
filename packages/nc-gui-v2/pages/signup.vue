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

const valid = ref()
let error = $ref<string | null>(null)

const form = reactive({
  email: '',
  password: '',
  passwordRepeat: '',
})

const formRules = {
  email: [
    // E-mail is required
    (v: string) => !!v || t('msg.error.signUpRules.emailReqd'),
    // E-mail must be valid format
    (v: string) => isEmail(v) || t('msg.error.signUpRules.emailInvalid'),
  ],
  password: [
    // Password is required
    (v: string) => !!v || t('msg.error.signUpRules.passwdRequired'),
    (v: string) => v.length >= 8 || t('msg.error.signUpRules.passwdLength'),
  ],
  passwordRepeat: [
    // Passwords match
    (v: string) => v === form.password || t('msg.error.signUpRules.passwdMismatch'),
  ],
}

const signUp = async () => {
  error = null
  try {
    const { token } = await $api.auth.signup(form)
    $state.signIn(token!)
    await navigateTo('/projects')
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
    <v-form
      ref="formValidator"
      v-model="valid"
      class="h-[calc(100%_+_90px)] min-h-[600px] flex justify-center items-center"
      @submit.prevent="signUp"
    >
      <div class="h-full w-full flex flex-col flex-wrap justify-center items-center">
        <div
          class="bg-white dark:(!bg-gray-900 !text-white) md:relative flex flex-col justify-center gap-2 w-full max-w-[500px] mx-auto p-8 md:(rounded-lg border-1 border-gray-200 shadow-xl)"
        >
          <div
            style="left: -moz-calc(50% - 45px); left: -webkit-calc(50% - 45px); left: calc(50% - 45px)"
            class="absolute top-12 md:top-[-10%] rounded-lg bg-primary"
          >
            <img width="90" height="90" src="~/assets/img/icons/512x512-trans.png" />
          </div>

          <h1 class="prose-2xl font-bold self-center my-4">{{ $t('general.signUp') }}</h1>

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

          <v-text-field
            id="password"
            v-model="form.password"
            class="bg-white dark:!bg-gray-900"
            :rules="formRules.password"
            :label="$t('labels.password')"
            :placeholder="$t('labels.password')"
            :persistent-placeholder="true"
            type="password"
            @focus="resetError"
          />

          <v-text-field
            id="password_repeat"
            v-model="form.passwordRepeat"
            class="bg-white dark:!bg-gray-900"
            :rules="formRules.passwordRepeat"
            :label="`Repeat ${$t('labels.password')}`"
            :placeholder="`Repeat ${$t('labels.password')}`"
            :persistent-placeholder="true"
            type="password"
            @focus="resetError"
          />

          <div class="self-center flex items-center justify-between w-full">
            <button
              :disabled="!valid"
              :class="[
                !valid
                  ? '!opacity-50 !cursor-default'
                  : 'shadow-md hover:(text-primary bg-primary/10 dark:text-white dark:!bg-primary/50)',
              ]"
              class="ml-1 border-1 border-solid border-gray-300 transition-color duration-100 ease-in rounded-lg p-4 bg-gray-100/50"
              type="submit"
            >
              <span class="flex items-center gap-2"><MaterialSymbolsRocketLaunchOutline /> {{ $t('general.signUp') }}</span>
            </button>
            <div class="text-end prose-sm">
              {{ $t('msg.info.signUp.alreadyHaveAccount') }}
              <nuxt-link class="text-primary underline hover:opacity-75" to="/signin">{{ $t('general.signIn') }}</nuxt-link>
            </div>
          </div>
        </div>
      </div>
    </v-form>
  </NuxtLayout>
</template>
