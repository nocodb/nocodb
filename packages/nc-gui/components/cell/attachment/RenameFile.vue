<script lang="ts" setup>
import { generateUniqueName, onKeyStroke, onMounted, reactive, ref } from '#imports'

const props = defineProps<{
  title: string
}>()

const emit = defineEmits<{
  (event: 'rename', value: string): void
  (event: 'cancel'): void
}>()

const inputEl = ref()

const visible = ref(true)

const form = reactive({
  title: props.title,
})

function renameFile(fileName: string) {
  visible.value = false
  emit('rename', fileName)
}

async function useRandomName() {
  form.title = await generateUniqueName()
}

const rules = {
  title: [{ required: true, message: 'title is required.' }],
}

function onCancel() {
  visible.value = false
  emit('cancel')
}

onKeyStroke('Escape', onCancel)

onMounted(() => {
  inputEl.value.select()
  inputEl.value.focus()
})
</script>

<template>
  <a-modal
    :visible="visible"
    :closable="false"
    :mask-closable="false"
    destroy-on-close
    title="Rename file"
    class="nc-attachment-rename-modal"
    width="min(100%, 620px)"
    :footer="null"
    centered
    @cancel="onCancel"
  >
    <div class="flex flex-col items-center justify-center h-full">
      <a-form class="w-full h-full" no-style :model="form" @finish="renameFile(form.title)">
        <a-form-item class="w-full" name="title" :rules="rules.title">
          <a-input ref="inputEl" v-model:value="form.title" class="w-full" :placeholder="$t('general.rename')" />
        </a-form-item>
        <div class="flex items-center justify-center gap-6 w-full mt-4">
          <button class="scaling-btn bg-opacity-100" type="submit">
            <span>{{ $t('general.confirm') }}</span>
          </button>
          <button class="scaling-btn bg-opacity-100" type="button" @click="useRandomName">
            <span>{{ $t('title.generateRandomName') }}</span>
          </button>
        </div>
      </a-form>
    </div>
  </a-modal>
</template>

<style scoped lang="scss">
.nc-attachment-rename-modal {
  .ant-input-affix-wrapper,
  .ant-input {
    @apply !appearance-none my-1 border-1 border-solid border-primary border-opacity-50 rounded;
  }
}
</style>
