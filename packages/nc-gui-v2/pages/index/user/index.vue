<script setup lang="ts">
import { navigateTo, useNuxtApp, useRoute } from '#app'
import MdiAccountCog from '~icons/mdi/account-cog'
import MdiFolderOutline from '~icons/mdi/folder-outline'

const { $api } = useNuxtApp()

const route = useRoute()
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
