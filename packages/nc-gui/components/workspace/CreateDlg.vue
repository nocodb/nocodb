<script setup lang="ts">
import { message } from 'ant-design-vue'
import InputOrTags from './InputOrTags'
import { Form, ref, useVModel, useWorkspace } from '#imports'
import { extractSdkResponseErrorMsg } from '~/utils'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue', 'success'])

const dialogShow = useVModel(props, 'modelValue', emit)

const { createWorkspace } = useWorkspace()

const workspace = ref({})
const isCreating = ref(false)

const useForm = Form.useForm

const validators = computed(() => {
  // todo: validation
  return {
    title: [
      {
        validator: (_: any, value: any) => {
          // validate duplicate alias
          return new Promise((resolve, reject) => {
            if (!value?.trim()) {
              return reject(new Error('Workspace name required'))
            }
            return resolve(true)
          })
        },
      },
    ],
  }
})

const { validate, validateInfos } = useForm(workspace, validators)
const _createWorkspace = async () => {
  try {
    await validate()
  } catch (e: any) {
    e.errorFields.map((f: Record<string, any>) => message.error(f.errors.join(',')))
    if (e.errorFields.length) return
  }

  isCreating.value = true

  try {
    const workspaceRes = await createWorkspace(workspace.value)
    emit('success', workspaceRes)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  setTimeout(() => {
    isCreating.value = false
  }, 500)
}

const inputRef = ref()

watch(
  dialogShow,
  (val) => {
    if (!val) {
      workspace.value = {
        title: 'Untitled Workspace',
      }
    } else {
      nextTick(() => {
        inputRef.value?.$el?.focus()
        inputRef.value?.$el?.select()
      })
    }
  },
  {
    immediate: true,
  },
)

watch(
  inputRef,
  () => {
    inputRef.value?.$el?.focus()
    inputRef.value?.$el?.select()
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <NcModal v-model:visible="dialogShow" size="small">
    <template #header> {{ $t('activity.createWorkspace') }} </template>
    <a-form :model="workspace" name="create-new-workspace-form" class="!mt-2" @keydown.enter="_createWorkspace">
      <a-form-item v-bind="validateInfos.title">
        <InputOrTags ref="inputRef" v-model="workspace.title" class="nc-input-md" />
      </a-form-item>
      <div class="flex flex-row justify-end mt-7 gap-x-2">
        <NcButton type="secondary" :label="$t('general.cancel')" @click="dialogShow = false" />
        <NcButton
          type="primary"
          :label="$t('activity.createWorkspace')"
          loading-label="Creating Workspace"
          :loading="isCreating"
          :disabled="validateInfos.title.validateStatus === 'error'"
          @click="_createWorkspace"
        />
      </div>
      <!-- <a-form-item v-bind="validateInfos.description">
          <a-textarea
            v-model:value="workspace.description"
            size="large"
            hide-details
            data-testid="create-workspace-description-input"
            placeholder="Workspace description"
          />
        </a-form-item> -->
    </a-form>
  </NcModal>
</template>

<style scoped lang="scss">
.nc-workspace-advanced-options {
  max-height: 0;
  transition: 0.3s max-height;
  overflow: hidden;

  &.active {
    max-height: 200px;
  }
}
</style>
