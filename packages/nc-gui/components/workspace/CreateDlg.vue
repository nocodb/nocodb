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
  try {
    const workspaceRes = await createWorkspace(workspace.value)
    emit('success', workspaceRes)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
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
  <GeneralModal v-model:visible="dialogShow" @keydown.esc="dialogShow = false">
    <div class="px-7 py-5">
      <a-form :model="workspace" name="create-new-workspace-form" @keydown.enter="_createWorkspace">
        <!-- Create A New Table -->
        <div class="prose-xl font-bold self-center mb-5">{{ $t('activity.createWorkspace') }}</div>

        <a-form-item v-bind="validateInfos.title">
          <InputOrTags ref="inputRef" v-model="workspace.title" class="!rounded" />
        </a-form-item>
        <div class="flex flex-row justify-end mt-10">
          <a-button key="submit" class="!rounded" size="large" type="primary" @click="_createWorkspace">{{
            $t('general.submit')
          }}</a-button>
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
    </div>
  </GeneralModal>
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
