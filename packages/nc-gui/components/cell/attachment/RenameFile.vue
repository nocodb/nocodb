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
  <GeneralModal v-model:visible="visible" class="nc-attachment-rename-modal !w-[30rem]">
    <div class="flex flex-col items-center justify-center h-full p-8">
      <div class="text-lg font-semibold self-start mb-4">Rename File</div>

      <a-form class="w-full h-full" no-style :model="form" @finish="renameFile(form.title)">
        <a-form-item class="w-full" name="title" :rules="rules.title">
          <a-input ref="inputEl" v-model:value="form.title" class="w-full" :placeholder="$t('general.rename')" />
        </a-form-item>
        <!-- <div class="flex items-center justify-center gap-6 w-full mt-4">
          <button class="scaling-btn bg-opacity-100" type="submit">
            <span>{{ $t('general.confirm') }}</span>
          </button>
          <button class="scaling-btn bg-opacity-100" type="button" @click="useRandomName">
            <span>{{ $t('title.generateRandomName') }}</span>
          </button>
        </div> -->
        <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
          <NcButton key="submit" html-type="submit" type="secondary">{{ $t('general.confirm') }}</NcButton>
          <NcButton type="primary" @click="useRandomName">{{ $t('title.generateRandomName') }} </NcButton>
        </div>
      </a-form>
    </div>
  </GeneralModal>
</template>

<style scoped lang="scss">
.nc-attachment-rename-modal {
  .ant-input-affix-wrapper,
  .ant-input {
    @apply !appearance-none my-1 border-1 border-solid border-primary border-opacity-50 rounded;
  }
}
</style>
