<script lang="ts" setup>
import { generateUniqueName, onKeyStroke, onMounted, reactive, ref } from '#imports'

const props = defineProps<{
  fileName: string
  fileNames: string[]
}>()

const emit = defineEmits<{
  (event: 'rename', value: string): void
  (event: 'cancel'): void
}>()

const inputEl = ref()

const visible = ref(true)

const fileEnding = props.fileName.split('.').pop()
const form = reactive({
  name: props.fileName.replace(`.${fileEnding}`, ''),
})

function renameFile(fileName: string) {
  visible.value = false
  emit('rename', fileName)
}

async function useRandomName() {
  form.name = await generateUniqueName()
}

const rules = {
  name: [
    { required: true, message: 'Filename is required.' },
    {
      validator: (_: unknown, v: string) =>
        new Promise((resolve, reject) => {
          props.fileNames.every((fileName) => fileName.replace(`.${fileEnding}`, '') !== v)
            ? resolve(true)
            : reject(new Error(`File name should be unique.`))
        }),
      message: 'File name should be unique.',
    },
  ],
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
      <a-form class="w-full h-full" no-style :model="form" @finish="renameFile(`${form.name}.${fileEnding}`)">
        <a-form-item class="w-full" name="name" :rules="rules.name">
          <a-input ref="inputEl" v-model:value="form.name" class="w-full" :placeholder="$t('msg.info.rename')" />
        </a-form-item>

        <div class="flex items-center justify-center gap-6 w-full mt-4">
          <button class="scaling-btn bg-opacity-100" type="submit">
            <!-- Rename -->
            <span>Rename</span>
          </button>

          <button class="scaling-btn bg-opacity-100" type="button" @click="useRandomName">
            <!-- Rename -->
            <span>Generate random name</span>
          </button>
        </div>
      </a-form>
    </div>
  </a-modal>
</template>

<style lang="scss">
.nc-attachment-rename-modal {
  .ant-input-affix-wrapper,
  .ant-input {
    @apply !appearance-none my-1 border-1 border-solid border-primary border-opacity-50 rounded;
  }
}
</style>
