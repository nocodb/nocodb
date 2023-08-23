<script lang="ts" setup>
const isOpen = ref(false)

const editOrAdd = ref(false)
const currentHook = ref<Record<string, any>>()

async function editHook(hook: Record<string, any>) {
  editOrAdd.value = true
  currentHook.value = hook
}

async function addHook() {
  editOrAdd.value = true
  currentHook.value = undefined
}
</script>

<template>
  <GeneralModal v-model:visible="isOpen">
    <LazyWebhookEditor v-if="editOrAdd" :hook="currentHook" @back-to-list="editOrAdd = false" />

    <LazyWebhookList v-else @edit="editHook" @add="addHook" />
  </GeneralModal>
</template>
