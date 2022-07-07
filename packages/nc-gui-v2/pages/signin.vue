<script setup lang="ts">
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import { navigateTo, useNuxtApp } from '#app'
import MdiLogin from '~icons/mdi/login'
import MaterialSymbolsWarning from '~icons/material-symbols/warning'

const { $api, $state } = useNuxtApp()

const error = ref()
const valid = ref()
const form = reactive({
  email: '',
  password: '',
})

const signIn = async () => {
  error.value = null
  try {
    const { token } = await $api.auth.signin(form)
    $state.value.token = token
    $state.value.user = { email: form.email }
    await navigateTo('/projects')
  } catch (e: any) {
    // todo: errors should not expose what was wrong (i.e. do not show "Password is wrong" messages)
    error.value = await extractSdkResponseErrorMsg(e)
  }
}
</script>

<template>
  <NuxtLayout>
    <v-form
      ref="formValidator"
      v-model="valid"
      class="h-full md:h-3/4 min-h-[600px] flex justify-center items-center"
      @submit.prevent="signIn"
    >
      <div class="h-full w-full flex flex-col flex-wrap justify-center items-center">
        <div
          class="flex flex-col justify-center gap-2 w-full max-w-[500px] mx-auto p-8 md:(rounded-lg border-1 border-gray-200 shadow-lg)"
        >
          <h1 class="prose-xl self-center">Sign-in to your account</h1>

          <v-divider class="mb-4" />

          <div v-if="error" class="self-center mb-4 bg-red-500 text-white rounded-lg w-3/4 p-1">
            <div class="flex items-center gap-2 justify-center"><MaterialSymbolsWarning /> {{ error }}</div>
          </div>

          <v-text-field id="email" v-model="form.email" :label="$t('labels.email')" type="text" />

          <v-text-field id="password" v-model="form.password" :label="$t('labels.password')" type="password" />

          <div class="self-center">
            <button
              class="border-1 border-solid border-gray-300 transition-color duration-100 ease-in rounded-lg shadow-md p-4 bg-gray-100/50 hover:(text-primary bg-primary/25)"
              type="submit"
            >
              <span class="flex items-center gap-2"><MdiLogin /> {{ $t('general.signIn') }}</span>
            </button>
          </div>
        </div>
      </div>
    </v-form>
  </NuxtLayout>
</template>
