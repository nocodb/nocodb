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

watch(dialogShow, (val) => {
  if (!val) {
    workspace.value = {}
  }
})
</script>

<template>
  <a-modal
    v-model:visible="dialogShow"
    :class="{ active: dialogShow }"
    width="max(30vw, 600px)"
    centered
    wrap-class-name="nc-modal-workspace-create"
    @keydown.esc="dialogShow = false"
  >
    <template #footer>
      <a-button key="back" size="large" @click="dialogShow = false">{{ $t('general.cancel') }}</a-button>

      <a-button key="submit" size="large" type="primary" @click="_createWorkspace">{{ $t('general.submit') }}</a-button>
    </template>

    <div class="pl-10 pr-10 pt-5">
      <a-form :model="workspace" name="create-new-workspace-form" @keydown.enter="_createWorkspace">
        <!-- Create A New Table -->
        <div class="prose-xl font-bold self-center my-4">{{ $t('activity.createWorkspace') }}</div>

        <!-- todo: i18n -->
        <div class="mb-2">Workspace Name</div>

        <a-form-item v-bind="validateInfos.title">
          <InputOrTags v-model="workspace.title" />

          <!--          <a-input -->
          <!--            :ref="inputEl" -->
          <!--            v-model:value="workspace.title" -->
          <!--            size="large" -->
          <!--            hide-details -->
          <!--            data-testid="create-workspace-title-input" -->
          <!--            placeholder="Workspace name" -->
          <!--          /> -->
        </a-form-item>
        <a-form-item v-bind="validateInfos.description">
          <a-textarea
            v-model:value="workspace.description"
            size="large"
            hide-details
            data-testid="create-workspace-title-input"
            placeholder="Workspace description"
          />
        </a-form-item>
      </a-form>
    </div>
  </a-modal>
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
