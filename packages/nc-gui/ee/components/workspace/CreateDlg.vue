<script setup lang="ts">
import InputOrTags from './InputOrTags.vue'

const props = defineProps<{
  modelValue: boolean
  orgId?: string
}>()

const emit = defineEmits(['update:modelValue', 'success'])

const dialogShow = useVModel(props, 'modelValue', emit)

const { createWorkspace } = useWorkspace()

const workspace = ref({})
const isCreating = ref(false)

const useForm = Form.useForm

const { t } = useI18n()

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

            if (value?.trim().length > 255) {
              return reject(new Error('Workspace name should be less than 255 characters'))
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
    if (e?.errorFields?.length) {
      e.errorFields.map((f: Record<string, any>) => message.error(f.errors.join(',')))
      return
    }

    message.error((await extractSdkResponseErrorMsg(e)) ?? 'Something went wrong')
  }

  isCreating.value = true

  try {
    const workspaceRes = props.orgId
      ? await createWorkspace({ ...workspace.value, fk_org_id: props.orgId })
      : await createWorkspace(workspace.value)
    if (workspaceRes) {
      emit('success', workspaceRes)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    dialogShow.value = false
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
        title: t('general.untitledEntity', { entity: t('objects.workspace') }),
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
  <NcModal v-model:visible="dialogShow" size="small" :show-separator="false">
    <template #header>
      <div class="flex flex-row items-center gap-x-2 text-base text-gray-800">
        <GeneralIcon icon="workspaceDefault" />
        <div>
          {{ $t('activity.createWorkspace') }}
        </div>
      </div>
    </template>
    <a-form :model="workspace" name="create-new-workspace-form" class="!mt-1" @keydown.enter="_createWorkspace">
      <a-form-item v-bind="validateInfos.title" class="!mb-0">
        <InputOrTags ref="inputRef" v-model="workspace.title" class="nc-input-sm nc-input-shadow" />
      </a-form-item>
      <div class="flex flex-row justify-end mt-5 gap-x-2">
        <NcButton type="secondary" size="small" @click="dialogShow = false">
          {{ $t('general.cancel') }}
        </NcButton>
        <NcButton
          v-e="['a:workspace:create']"
          type="primary"
          size="small"
          :loading="isCreating"
          :disabled="validateInfos.title.validateStatus === 'error'"
          @click="_createWorkspace"
        >
          {{ $t('activity.createWorkspace') }}
          <template #loading> Creating Workspace </template>
        </NcButton>
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
