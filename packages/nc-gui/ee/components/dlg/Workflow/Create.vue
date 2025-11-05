<script setup lang="ts">
import type { WorkflowType } from 'nocodb-sdk'
import { validateScriptName } from '~/utils/validation'

const props = defineProps<{
  modelValue: boolean
  baseId: string
}>()

const emits = defineEmits<Emits>()

interface Emits {
  (event: 'update:modelValue', value: boolean): void
  (event: 'created', value: WorkflowType): void
}

const baseStore = useBase()
const { baseId: activeBaseId } = storeToRefs(baseStore)

const baseId = toRef(props, 'baseId')

const dialogShow = useVModel(props, 'modelValue', emits)

const inputEl = ref<HTMLInputElement>()

const workflowStore = useWorkflowStore()

const { createWorkflow: createNewWorkflow } = workflowStore

const { workflows: workflowsMap } = storeToRefs(workflowStore)

const workflow = reactive<Pick<WorkflowType, 'title' | 'description'>>({})

const workflows = computed(() => workflowsMap.value.get(baseId.value) || [])

const createWorkflow = async () => {
  return await createNewWorkflow(props.baseId, {
    title: workflow.title,
    description: workflow.description,
  })
}

const useForm = Form.useForm

const enableDescription = ref(false)

const removeDescription = () => {
  workflow.description = ''
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
            if ((workflows.value || []).some((t) => t.title === (value || ''))) {
              return reject(new Error('Duplicate workflow name'))
            }
            return resolve(true)
          })
        },
      },
    ],
  }
})
const { validate, validateInfos } = useForm(workflow, validators)

const creating = ref(false)

const _createWorkflow = async () => {
  if (creating.value) return
  try {
    creating.value = true
    await validate()
    const createdWorkflow = await createWorkflow()
    dialogShow.value = false
    emits('created', createdWorkflow as WorkflowType)
  } catch (e: any) {
    console.error(e)

    if (e?.errorFields?.length) {
      e.errorFields.map((f: Record<string, any>) => message.error(f.errors.join(',')))
      return
    }

    message.error(await extractSdkResponseErrorMsg(e))
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
  if (!workflows.value) return
  workflow.title = generateUniqueTitle(`Workflow`, workflows.value ?? [], 'title', '-', true)

  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
  })
})

watch(activeBaseId, () => {
  if (activeBaseId.value !== props.baseId) {
    dialogShow.value = false
  }
})
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    :header="$t('activity.createWorkflow')"
    size="xs"
    height="auto"
    :centered="false"
    nc-modal-class-name="!p-0"
    class="!top-[25vh]"
    wrap-class-name="nc-modal-workflow-create-wrapper"
    @keydown.esc="dialogShow = false"
  >
    <div class="p-5 flex flex-col gap-5">
      <div class="flex justify-between w-full items-center">
        <div class="flex flex-row items-center gap-x-2 text-base font-semibold text-nc-content-gray">
          <GeneralIcon icon="ncAutomation" class="!text-nc-content-gray-subtle2 w-5 h-5" />
          {{ $t('activity.createWorkflow') }}
        </div>
      </div>

      <a-form
        layout="vertical"
        :model="workflow"
        name="create-new-workflow-form"
        class="flex flex-col px-5 gap-5"
        @keydown.enter="_createWorkflow"
        @keydown.esc="dialogShow = false"
      >
        <div class="flex flex-col gap-5">
          <a-form-item v-bind="validateInfos.title" class="relative nc-workflow-input-wrapper relative">
            <a-input
              ref="inputEl"
              v-model:value="workflow.title"
              class="nc-workflow-input nc-input-sm nc-input-shadow"
              hide-details
              data-testid="create-workflow-title-input"
              :placeholder="$t('msg.info.enterWorkflowName')"
            />
          </a-form-item>

          <a-form-item v-if="enableDescription" v-bind="validateInfos.description" class="!mb-0">
            <div class="flex gap-3 text-nc-content-gray h-7 mb-1 items-center justify-between">
              <span class="text-[13px]">
                {{ $t('labels.description') }}
              </span>
              <NcButton type="text" class="!h-6 !w-5" size="xsmall" @click="removeDescription">
                <GeneralIcon icon="delete" class="text-nc-content-gray-subtle w-3.5 h-3.5" />
              </NcButton>
            </div>

            <a-textarea
              ref="inputEl"
              v-model:value="workflow.description"
              class="nc-input-sm nc-input-text-area nc-input-shadow px-3 !text-nc-content-gray max-h-[150px] min-h-[100px]"
              hide-details
              data-testid="create-workflow-title-input"
              :placeholder="$t('msg.info.enterWorkflowDescription')"
            />
          </a-form-item>
        </div>
        <div class="flex flex-row items-center justify-between gap-x-2">
          <NcButton v-if="!enableDescription" size="small" type="text" @click.stop="toggleDescription">
            <div class="flex !text-nc-content-gray-subtle items-center gap-2">
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
              v-e="['a:workflow:create']"
              type="primary"
              size="small"
              :disabled="validateInfos.title?.validateStatus === 'error' || creating"
              :loading="creating"
              @click="_createWorkflow"
            >
              {{ $t('activity.createWorkflow') }}
              <template #loading> {{ $t('title.creatingWorkflow') }} </template>
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
.nc-modal-wrapper.nc-modal-workflow-create-wrapper {
  .ant-modal-content {
    @apply !rounded-5;
  }
}
</style>
