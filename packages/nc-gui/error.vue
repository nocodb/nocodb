<script lang="ts" setup>
const props = defineProps({ error: Object })

console.log('error', props.error)
</script>

<template>
  <GeneralPageDoesNotExist />
</template>
