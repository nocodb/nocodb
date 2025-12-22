<script setup lang="ts">
const scriptStore = useScriptStore()

const { activeScript } = storeToRefs(scriptStore)

useProvideScriptStore(activeScript)
</script>

<template>
  <SmartsheetScript />
</template>
