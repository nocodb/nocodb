<script setup lang="ts">
import type { RuleObject } from 'ant-design-vue/es/form'
import type { Form, Input } from 'ant-design-vue'
import type { VNodeRef } from '@vue/runtime-core'

const props = defineProps<{
  modelValue: boolean
  isCreateNewActionMenu?: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const dialogShow = useVModel(props, 'modelValue', emit)

const basesStore = useBases()

const { createProject: _createProject } = basesStore

const { isSharedBase } = storeToRefs(useBase())

const { navigateToProject } = useGlobal()

const { refreshCommandPalette } = useCommandPalette()

const nameValidationRules = [
  {
    required: true,
    message: t('msg.info.dbNameRequired'),
  },
  baseTitleValidator(),
] as RuleObject[]

const form = ref<typeof Form>()

const formState = ref({
  title: '',
  meta: {
    iconColor: baseIconColors[Math.floor(Math.random() * 1000) % baseIconColors.length],
  },
})

const creating = ref(false)

const input: VNodeRef = ref<typeof Input>()

const createProject = async () => {
  if (formState.value.title) {
    formState.value.title = formState.value.title.trim()
  }

  creating.value = true
  try {
    const base = await _createProject({
      title: formState.value.title,
      meta: formState.value.meta,
    })

    navigateToProject({
      baseId: base.id!,
      workspaceId: 'nc',
    })
    dialogShow.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    setTimeout(() => {
      creating.value = false
    }, 500)
    refreshCommandPalette()
  }
}

const onInit = () => {
  // Clear errors
  setTimeout(async () => {
    form.value?.resetFields()

    formState.value = {
      title: 'Base',
      meta: {
        iconColor: baseIconColors[Math.floor(Math.random() * 1000) % baseIconColors.length],
      },
    }

    await nextTick()

    input.value?.$el?.focus()
    input.value?.$el?.select()
  }, 5)
}



watch(dialogShow, (n) => {
  if (n) {
    onInit()
  }
})

</script>

<template>
  <NcModal v-model:visible="dialogShow" size="small" :show-separator="false" wrap-class-name="nc-modal-wrapper">

    <template #header>
      <!-- Create A New Base -->
      <div class="flex flex-row items-center text-base text-nc-content-gray">
        <GeneralProjectIcon :color="formState.meta.iconColor" class="mr-2.5" />
        {{
          $t('general.createEntity', {
            entity: 'Base',
          })
        }}
      </div>
    </template>

    <div class="mt-1">
      <a-form ref="form" :model="formState" name="basic" layout="vertical" class="w-full !mx-auto" no-style
        autocomplete="off" @finish="createProject">
        <a-form-item name="title" :rules="nameValidationRules" class="!mb-0">
          <a-input ref="input" v-model:value="formState.title" name="title"
            class="nc-metadb-base-name nc-input-sm nc-input-shadow" placeholder="Title" />
        </a-form-item>
      </a-form>

      <div class="flex flex-row justify-end mt-5 gap-x-2">
        <NcButton type="secondary" size="small" :disabled="creating" @click="dialogShow = false">{{
          $t('general.cancel')
          }}</NcButton>
        <NcButton v-e="['a:base:create']" data-testid="docs-create-proj-dlg-create-btn" :loading="creating"
          type="primary" size="small" :disabled="creating" :label="`${$t('general.create')} Base`"
          :loading-label="`${$t('general.creating')} Base`" @click="createProject">
          {{
            $t('general.createEntity', {
              entity: 'Base',
            })
          }}
          <template #loading>
            {{
              $t('general.creatingEntity', {
                entity: 'Base',
              })
            }}
          </template>
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
