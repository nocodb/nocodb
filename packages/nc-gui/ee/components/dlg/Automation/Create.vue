<script setup lang="ts">
import type { ScriptType } from 'nocodb-sdk'
import { validateScriptName } from '~/utils/validation'

const props = defineProps<{
  modelValue: boolean
  baseId: string
}>()

const emits = defineEmits<Emits>()

interface Emits {
  (event: 'update:modelValue', value: boolean): void
  (event: 'created', value: ScriptType): void
}

const baseId = toRef(props, 'baseId')

const dialogShow = useVModel(props, 'modelValue', emits)

const inputEl = ref<HTMLInputElement>()

const automationStore = useAutomationStore()

const { createAutomation } = automationStore

const { automations } = storeToRefs(automationStore)

const script = reactive<Pick<ScriptType, 'title' | 'description'>>({})

const scripts = computed(() => automations.value.get(baseId.value) || [])

const createScript = async () => {
  return await createAutomation(props.baseId, {
    title: script.title,
    description: script.description,
  })
}

const useForm = Form.useForm

const enableDescription = ref(false)

const removeDescription = () => {
  script.description = ''
  enableDescription.value = false
}

const validators = computed(() => {
  return {
    title: [
      validateScriptName,
      {
        validator: (_: any, value: any) => {
          // validate duplicate alias
          return new Promise((resolve, reject) => {
            if ((scripts.value || []).some((t) => t.title === (value || ''))) {
              return reject(new Error('Duplicate script name'))
            }
            return resolve(true)
          })
        },
      },
    ],
  }
})
const { validate, validateInfos } = useForm(script, validators)

const creating = ref(false)

const _createScript = async () => {
  if (creating.value) return
  try {
    creating.value = true
    await validate()
    const createdScript = await createScript()
    dialogShow.value = false
    emits('created', createdScript as ScriptType)
  } catch (e: any) {
    console.error(e)
    message.error(await extractSdkResponseErrorMsg(e))
    if (e.errorFields.length) return
  } finally {
    setTimeout(() => {
      creating.value = false
    }, 500)
  }
}

const toggleDescription = () => {
  if (enableDescription.value) {
    enableDescription.value = false
  } else {
    enableDescription.value = true
    setTimeout(() => {
      inputEl.value?.focus()
    }, 100)
  }
}

onMounted(() => {
  if (!scripts.value) return
  script.title = generateUniqueTitle(`Script`, scripts.value ?? [], 'title', '-', true)

  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
  })
})
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    :header="$t('activity.createScript')"
    size="xs"
    height="auto"
    :centered="false"
    nc-modal-class-name="!p-0"
    class="!top-[25vh]"
    wrap-class-name="nc-modal-script-create-wrapper"
    @keydown.esc="dialogShow = false"
  >
    <div class="p-5 flex flex-col gap-5">
      <div class="flex justify-between w-full items-center">
        <div class="flex flex-row items-center gap-x-2 text-base font-semibold text-gray-800">
          <GeneralIcon icon="ncAutomation" class="!text-gray-600 w-5 h-5" />
          {{ $t('activity.createScript') }}
        </div>
      </div>

      <a-form
        layout="vertical"
        :model="script"
        name="create-new-script-form"
        class="flex flex-col px-5 gap-5"
        @keydown.enter="_createScript"
        @keydown.esc="dialogShow = false"
      >
        <div class="flex flex-col gap-5">
          <a-form-item v-bind="validateInfos.title" class="relative nc-script-input-wrapper relative">
            <a-input
              ref="inputEl"
              v-model:value="script.title"
              class="nc-script-input nc-input-sm nc-input-shadow"
              hide-details
              data-testid="create-script-title-input"
              :placeholder="$t('msg.info.enterScriptName')"
            />
          </a-form-item>

          <a-form-item v-if="enableDescription" v-bind="validateInfos.description" class="!mb-0">
            <div class="flex gap-3 text-gray-800 h-7 mb-1 items-center justify-between">
              <span class="text-[13px]">
                {{ $t('labels.description') }}
              </span>
              <NcButton type="text" class="!h-6 !w-5" size="xsmall" @click="removeDescription">
                <GeneralIcon icon="delete" class="text-gray-700 w-3.5 h-3.5" />
              </NcButton>
            </div>

            <a-textarea
              ref="inputEl"
              v-model:value="script.description"
              class="nc-input-sm nc-input-text-area nc-input-shadow px-3 !text-gray-800 max-h-[150px] min-h-[100px]"
              hide-details
              data-testid="create-script-title-input"
              :placeholder="$t('msg.info.enterScriptDescription')"
            />
          </a-form-item>
        </div>
        <div class="flex flex-row items-center justify-between gap-x-2">
          <NcButton v-if="!enableDescription" size="small" type="text" @click.stop="toggleDescription">
            <div class="flex !text-gray-700 items-center gap-2">
              <GeneralIcon icon="plus" class="h-4 w-4" />

              <span class="first-letter:capitalize">
                {{ $t('labels.addDescription').toLowerCase() }}
              </span>
            </div>
          </NcButton>
          <div v-else></div>
          <div class="flex gap-2 items-center">
            <NcButton type="secondary" size="small" :disabled="creating" @click="dialogShow = false">
              {{ $t('general.cancel') }}
            </NcButton>

            <NcButton
              v-e="['a:script:create']"
              type="primary"
              size="small"
              :disabled="validateInfos.title?.validateStatus === 'error' || creating"
              :loading="creating"
              @click="_createScript"
            >
              {{ $t('activity.createScript') }}
              <template #loading> {{ $t('title.creatingScript') }} </template>
            </NcButton>
          </div>
        </div>
      </a-form>
    </div>
  </NcModal>
</template>

<style scoped lang="scss">
.ant-form-item {
  @apply mb-0;
}

.nc-input-text-area {
  padding-block: 8px !important;
}
</style>

<style lang="scss">
.nc-modal-wrapper.nc-modal-script-create-wrapper {
  .ant-modal-content {
    @apply !rounded-5;
  }
}
</style>
