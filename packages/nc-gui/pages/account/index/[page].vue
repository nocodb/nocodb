<script setup lang="ts"></script>

<template>
  <div>
    <AccountToken v-if="$route.params.page === 'tokens'" />
    <AccountSetup v-else-if="$route.params.page === 'setup'" />
    <AccountProfile v-else-if="$route.params.page === 'profile'" />
    <AccountAppStore v-else-if="$route.params.page === 'apps' && !isEeUI" />
    <span v-else></span>
  </div>
</template>
