<template>
  <v-cotainer>
    <v-card max-width="500" class="pa-4 mx-auto mt-10">
      {{userStore}}
      <v-form
          ref="formType"
          v-model="valid"
          lazy-validation
      >
        <!-- Enter your work email -->
        <v-text-field
            v-model="form.email"
            label="Email"
            required
        />

        <!-- Enter your password -->
        <v-text-field
            label="Password"
            v-model="form.password"
            name="input-10-2"
            min="8"
        />

        <v-btn
            class="mx-auto"
            large
            elevation-10
            :disabled="false"
            @click="signIn"
        >
          <b>Sign In</b>
        </v-btn>

      </v-form>
    </v-card>
  </v-cotainer>

</template>

<script setup lang="ts">
import {ref, reactive} from 'vue'

const valid = ref()
const form = reactive({
  email: '',
  password: ''
})
const userStore = user

</script>
<script lang="ts">
import {useNuxtApp} from "nuxt/app";
import {Api} from "nocodb-sdk";


// const {$api}: { $api: Api<any> } = useNuxtApp() as any
export default {
  methods: {
    signIn() {
      this.$api.auth.signin(this.form).then((res) => {
        console.log(res)
this.userStore.token = res
      })
    }
  }
}
</script>

<style scoped>

</style>
