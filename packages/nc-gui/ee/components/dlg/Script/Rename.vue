<script setup lang="ts">
import type { ScriptType } from 'nocodb-sdk'
import type { ComponentPublicInstance } from '@vue/runtime-core'

interface Props {
  modelValue?: boolean
  script: ScriptType
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'updated'])

const dialogShow = useVModel(props, 'modelValue', emit)

const script = toRef(props, 'script')

const scriptStore = useScriptStore()

const { updateScript } = scriptStore

const { scripts } = storeToRefs(scriptStore)

const scriptList = computed(() => scripts.value.get(script.value.base_id) || [])

const { $e } = useNuxtApp()

const { addUndo, defineProjectScope } = useUndoRedo()

const inputEl = ref<ComponentPublicInstance>()

const loading = ref(false)

const useForm = Form.useForm

const formState = reactive({
  title: '',
})

const validators = computed(() => {
  return {
    title: [
      validateScriptName,
      {
        validator: (_: any, value: any) => {
          // validate duplicate alias
          return new Promise((resolve, reject) => {
            if ((scriptList.value || []).some((t) => t.title === (value || ''))) {
              return reject(new Error('Duplicate script name'))
            }
            return resolve(true)
          })
        },
      },
    ],
  }
})

const { validateInfos } = useForm(formState, validators)

watchEffect(
  () => {
    if (script.value?.title) formState.title = `${script.value.title}`

    nextTick(() => {
      const input = inputEl.value?.$el as HTMLInputElement

      if (input) {
        input.setSelectionRange(0, formState.title.length)
        input.focus()
      }
    })
  },
  { flush: 'post' },
)

const renameScript = async (undo = false, disableTitleDiffCheck?: boolean | undefined) => {
  if (!script) return

  if (formState.title) {
    formState.title = formState.title.trim()
  }

  if (formState.title === script.value.title && !disableTitleDiffCheck) return

  loading.value = true
  try {
    await updateScript(script.value.base_id, script.value.id as string, {
      title: formState.title,
    })

    dialogShow.value = false

    if (!undo) {
      addUndo({
        redo: {
          fn: (t: string) => {
            formState.title = t
            renameScript(true, true)
          },
          args: [formState.title],
        },
        undo: {
          fn: (t: string) => {
            formState.title = t
            renameScript(true, true)
          },
          args: [script.value.title],
        },
        scope: defineProjectScope({ base_id: script.value.base_id }),
      })
    }

    $e('a:script:rename')

    dialogShow.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  loading.value = false
}
</script>

<template>
  <NcModal v-model:visible="dialogShow" size="small" :show-separator="false">
    <template #header>
      <div class="flex flex-row items-center gap-x-2">
        <GeneralIcon icon="rename" />
        {{ $t('activity.renameScript') }}
      </div>
    </template>
    <div class="mt-1">
      <a-form :model="formState" name="create-new-script-form">
        <a-form-item v-bind="validateInfos.title">
          <a-input
            ref="inputEl"
            v-model:value="formState.title"
            class="nc-input-sm nc-input-shadow"
            hide-details
            size="small"
            :placeholder="$t('msg.info.enterScriptName')"
            @keydown.enter="() => renameScript()"
          />
        </a-form-item>
      </a-form>
      <div class="flex flex-row justify-end gap-x-2 mt-5">
        <NcButton type="secondary" size="small" @click="dialogShow = false">{{ $t('general.cancel') }}</NcButton>

        <NcButton
          key="submit"
          type="primary"
          size="small"
          :disabled="validateInfos.title.validateStatus === 'error' || formState.title?.trim() === script.title"
          label="Rename Script"
          loading-label="Renaming Script"
          :loading="loading"
          @click="() => renameScript()"
        >
          {{ $t('title.renameScript') }}
          <template #loading> {{ $t('title.renamingScript') }}</template>
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
