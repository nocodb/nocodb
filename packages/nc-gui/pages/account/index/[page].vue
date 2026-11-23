<script setup lang="ts"></script>

<template>
  <div>
    <AccountProfile v-if="$route.params.page === 'profile'" />
    <AccountPreferences v-else-if="$route.params.page === 'preferences'" />
    <AccountToken v-else-if="$route.params.page === 'tokens'" />
    <AccountMcp v-else-if="$route.params.page === 'mcp'" />
    <span v-else></span>
  </div>
</template>
