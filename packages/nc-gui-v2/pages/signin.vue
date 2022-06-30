<template>
  <div>
    <!-- Enter your work email -->
    <Card class="p-4 mx-auto mt-5" style="max-width: 500px">
      <template #content>

        <Message class="" v-if="error" severity="error">{{ error }}</Message>

        <div class="p-float-label mt-5">
          <InputText id="email" type="text" v-model="form.email" style="width:100%"/>
          <label for="email">Email</label>
        </div>

        <!-- Enter your password -->
        <div class="p-float-label mt-5">
          <InputText id="password" type="password" v-model="form.password" style="width:100%"/>
          <label for="password">Password</label>
        </div>

        <div class="text-center">
          <Button
              class="mt-5"
              @click="signIn"
          >
            <b>Sign In</b>
          </Button>
        </div>
      </template>
    </Card>
  </div>

</template>

<script setup lang="ts">
import {ref, reactive} from 'vue'
import {useUser} from "~/composables/user";
import {extractSdkResponseErrorMsg} from "~/helpers/errorUtils";
import {useNuxtApp} from "#app";

const {$api} = useNuxtApp()
const valid = ref()
const error = ref()
const form = reactive({
  email: '',
  password: ''
})
const {user, setToken} = useUser()

const signIn = async () => {
  error.value = null
  try {
    const {token} = await $api.auth.signin(form)
    setToken(token)
  } catch (e) {
    error.value = await extractSdkResponseErrorMsg(e)
  }
}

</script>
<style scoped>

</style>
