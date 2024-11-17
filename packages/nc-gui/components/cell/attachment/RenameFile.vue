<script lang="ts" setup>
const props = defineProps<{
  title: string
}>()

const emit = defineEmits<{
  (event: 'rename', value: string): void
  (event: 'cancel'): void
}>()

const { t } = useI18n()

const inputEl = ref()

const visible = ref(true)

const form = reactive({
  title: props.title,
})

function renameFile(fileName: string) {
  visible.value = false
  emit('rename', fileName)
}

// generate random name for file
// async function useRandomName() {
//   form.title = await generateUniqueName()
// }

const rules = {
  title: [{ required: true, message: t('labels.titleRequired') }],
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
  <GeneralModal v-model:visible="visible" class="nc-attachment-rename-modal" size="small">
    <div class="flex flex-col items-center justify-center h-full p-6">
      <div class="text-lg font-semibold self-start mb-5">{{ $t('title.renameFile') }}</div>

      <a-form class="w-full h-full" no-style :model="form" @finish="renameFile(form.title)">
        <a-form-item class="w-full !mb-0" name="title" :rules="rules.title">
          <a-input
            ref="inputEl"
            v-model:value="form.title"
            class="w-full nc-input-sm nc-input-shadow"
            :placeholder="$t('general.rename')"
          />
        </a-form-item>
        <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
          <NcButton key="back" html-type="back" size="small" type="secondary">{{ $t('general.cancel') }}</NcButton>
          <NcButton key="submit" html-type="submit" size="small" type="primary">{{ $t('general.confirm') }}</NcButton>
        </div>
      </a-form>
    </div>
  </GeneralModal>
</template>
