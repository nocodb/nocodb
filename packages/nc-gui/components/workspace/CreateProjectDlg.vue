<script setup lang="ts">
import type { RuleObject } from 'ant-design-vue/es/form'
import type { Form, Input } from 'ant-design-vue'
import type { VNodeRef } from '@vue/runtime-core'
import { computed } from '@vue/reactivity'
import { NcProjectType, baseTitleValidator, extractSdkResponseErrorMsg, ref, useGlobal, useI18n, useVModel } from '#imports'

const props = defineProps<{
  modelValue: boolean
  type?: NcProjectType
}>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const dialogShow = useVModel(props, 'modelValue', emit)

const baseType = computed(() => props.type ?? NcProjectType.DB)

const basesStore = useBases()
const { createProject: _createProject } = basesStore

const { navigateToProject } = useGlobal()

const nameValidationRules = [
  {
    required: true,
    message: t('msg.info.dbNameRequired'),
  },
  baseTitleValidator,
] as RuleObject[]

const form = ref<typeof Form>()

const formState = ref({
  title: '',
})

const creating = ref(false)

const createProject = async () => {
  creating.value = true
  try {
    const base = await _createProject({
      type: baseType.value,
      title: formState.value.title,
    })

    navigateToProject({
      baseId: base.id!,
      type: baseType.value,
      workspaceId: 'nc',
    })
    dialogShow.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    setTimeout(() => {
      creating.value = false
    }, 500)
  }
}

const input: VNodeRef = ref<typeof Input>()

watch(dialogShow, async (n, o) => {
  if (n === o && !n) return

  // Clear errors
  setTimeout(async () => {
    form.value?.resetFields()

    formState.value = {
      title: 'Base',
    }

    await nextTick()

    input.value?.$el?.focus()
    input.value?.$el?.select()
  }, 5)
})

const typeLabel = computed(() => {
  switch (baseType.value) {
    case NcProjectType.DB:
    default:
      return 'Base'
  }
})
</script>

<template>
  <NcModal v-model:visible="dialogShow" size="small">
    <template #header>
      <!-- Create A New Table -->
      <div class="flex flex-row items-center">
        <GeneralProjectIcon :type="baseType" class="mr-2.5 !text-lg !h-4" />
        {{
          $t('general.createEntity', {
            entity: typeLabel,
          })
        }}
      </div>
    </template>
    <div class="mt-3">
      <a-form
        ref="form"
        :model="formState"
        name="basic"
        layout="vertical"
        class="w-full !mx-auto"
        no-style
        autocomplete="off"
        @finish="createProject"
      >
        <a-form-item name="title" :rules="nameValidationRules" class="m-10">
          <a-input
            ref="input"
            v-model:value="formState.title"
            name="title"
            class="nc-metadb-base-name nc-input-md"
            placeholder="Title"
          />
        </a-form-item>
      </a-form>

      <div class="flex flex-row justify-end mt-7 gap-x-2">
        <NcButton type="secondary" @click="dialogShow = false">{{ $t('general.cancel') }}</NcButton>
        <NcButton
          v-e="['a:base:create']"
          data-testid="docs-create-proj-dlg-create-btn"
          :loading="creating"
          type="primary"
          :label="`${$t('general.create')} ${typeLabel}`"
          :loading-label="`${$t('general.creating')} ${typeLabel}`"
          @click="createProject"
        >
          {{
            $t('general.createEntity', {
              entity: typeLabel,
            })
          }}
          <template #loading>
            {{
              $t('general.creatingEntity', {
                entity: typeLabel,
              })
            }}
          </template>
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style scoped lang="scss">
:deep(.ant-modal-content) {
  @apply !p-0;
}
</style>
