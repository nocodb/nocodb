<script setup lang="ts">
import { extractSdkResponseErrorMsg } from '~/helpers/errorUtils'
import { navigateTo } from '#app'

const { $api, $state } = useNuxtApp()

const error = ref()
const form = reactive({
  email: '',
  password: '',
})
const signUp = async () => {
  error.value = null
  try {
    const { token } = await $api.auth.signup(form)
    $state.value.token = token
    navigateTo('/projects')
  } catch (e: any) {
    error.value = await extractSdkResponseErrorMsg(e)
  }
}
</script>

<template>
  <div>
    <!-- Enter your work email -->
    <v-card class="pa-10 mx-auto mt-10" style="max-width: 500px">
      <v-card-text>
        <v-alert v-if="error" density="medium" class="mb-4" type="error">
          {{ error }}
        </v-alert>

        <div class="p-float-label">
          <v-text-field id="email" v-model="form.email" :label="$t('labels.email')" type="text" style="width: 100%" />
        </div>

        <!-- Enter your password -->
        <div class="p-float-label">
          <v-text-field
            id="password"
            v-model="form.password"
            :label="$t('labels.password')"
            type="password"
            style="width: 100%"
          />
        </div>

        <div class="text-center">
          <v-btn class="" @click="signUp">
            <b>{{ $t('general.signUp') }}</b>
          </v-btn>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped></style>
