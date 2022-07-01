<template>
  <div>
    <!-- Enter your work email -->
    <v-card class="pa-10 mx-auto mt-10" style="max-width: 500px">
      <v-card-text>

        <v-alert density="medium" class="mb-4" v-if="error" type="error">{{ error }}</v-alert>

        <div class="p-float-label ">
          <v-text-field label="Email" id="email" type="text" v-model="form.email" style="width:100%"/>
        </div>

        <!-- Enter your password -->
        <div class="p-float-label ">
          <v-text-field  label="Password" id="password" type="password" v-model="form.password" style="width:100%"/>
        </div>

        <div class="text-center">
          <v-btn
            class=""
            @click="signUp"
          >
            <b>Sign Up</b>
          </v-btn>
        </div>
      </v-card-text>
    </v-card>
  </div>

</template>

<script setup lang="ts">
import {ref, reactive} from 'vue'
import {useUser} from "~/composables/user";
import {extractSdkResponseErrorMsg} from "~/helpers/errorUtils";

const {$api, $router} = useNuxtApp()
const valid = ref()
const error = ref()
const form = reactive({
  email: '',
  password: ''
})
const {user, setToken} = useUser()

const signUp = async () => {
  error.value = null
  try {
    const {token} = await $api.auth.signup(form)
    await setToken(token)
    $router.push('/projects')
  } catch (e) {
    error.value = await extractSdkResponseErrorMsg(e)
  }
}

</script>
<style scoped>

</style>
