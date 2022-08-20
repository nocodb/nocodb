<script setup lang="ts">
interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const editOrAdd = ref(false)

const webhookEditorRef = ref()

const vModel = useVModel(props, 'modelValue', emits)

async function editHook(hook: Record<string, any>) {
  editOrAdd.value = true
  nextTick(async () => {
    webhookEditorRef.value.setHook(hook)
    await webhookEditorRef.value.onEventChange()
  })
}
</script>

<template>
  <a-drawer
    v-model:visible="vModel"
    :closable="false"
    placement="right"
    width="700px"
    :body-style="{ background: 'rgba(67, 81, 232, 0.05)', padding: '50px' }"
    @keydown.esc="vModel = false"
  >
    <div>
      <WebhookEditor v-if="editOrAdd" ref="webhookEditorRef" @back-to-list="editOrAdd = false" />
      <WebhookList v-else @edit="editHook" @add="editOrAdd = true" />
    </div>
    <div class="self-center flex flex-col flex-wrap gap-4 items-center mt-4 md:mx-8 md:justify-between justify-center">
      <a-button v-t="['e:hiring']" href="https://angel.co/company/nocodb" target="_blank" size="large">
        🚀 We are Hiring! 🚀
      </a-button>
    </div>
  </a-drawer>
</template>
