<script setup lang="ts">
import '@aws-amplify/ui-vue/styles.css';
import { Authenticator } from '@aws-amplify/ui-vue'
import { definePageMeta } from '#imports'

definePageMeta({
  requiresAuth: false,
  title: 'title.headLogin',
})
</script>

<template>
  <div class="py-10 flex justify-center">
    <authenticator initial-state="signUp" :social-providers="['google']" >

    <template v-slot="{ user, signOut }">
        <div>
        <h1>Hello {{ user.username }}!</h1>
        <button @click="signOut">Sign Out</button>
        </div>
      </template>
    </authenticator>
  </div>
</template>

<style scoped></style>
