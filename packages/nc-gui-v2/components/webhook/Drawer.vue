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
    :body-style="{ background: 'rgba(67, 81, 232, 0.05)', padding: '0px 0px', overflow: 'hidden' }"
    @keydown.esc="vModel = false"
  >
    <a-layout class="">
      <a-layout-content class="px-10 py-5 scrollbar-thin-primary">
        <WebhookEditor v-if="editOrAdd" ref="webhookEditorRef" @back-to-list="editOrAdd = false" />
        <WebhookList v-else @edit="editHook" @add="editOrAdd = true" />
      </a-layout-content>
      <a-layout-footer class="!bg-white flex">
        <a-button v-t="['e:hiring']" class="mx-auto mb-4" href="https://angel.co/company/nocodb" target="_blank" size="large">
          🚀 We are Hiring! 🚀
        </a-button>
      </a-layout-footer>
    </a-layout>
  </a-drawer>
</template>
