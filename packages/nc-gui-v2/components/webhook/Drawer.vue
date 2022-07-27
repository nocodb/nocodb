<script setup lang="ts">
interface Props {
  modelValue: boolean
}

const { modelValue } = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const editOrAdd = ref(false)

const dialogShow = computed({
  get() {
    return modelValue
  },
  set(v) {
    emit('update:modelValue', v)
  },
})

function editHook(hook: Record<string, any>) {
  editOrAdd.value = true
  // TODO: update editor ref hook
}
</script>

<template>
  <a-drawer v-model:visible="dialogShow" :closable="false" placement="right" width="700px" @keydown.esc="dialogShow = false">
    <WebhookEditor v-if="editOrAdd" @back-to-list="editOrAdd = false" />
    <WebhookList v-else @edit="editHook" @add="editOrAdd = true" />
    <div class="self-center flex flex-column flex-wrap gap-4 items-center mt-4 md:mx-8 md:justify-between justify-center">
      <a-button v-t="['e:hiring']" href="https://angel.co/company/nocodb" target="_blank" size="large">
        🚀 We are Hiring! 🚀
      </a-button>
    </div>
  </a-drawer>
</template>
