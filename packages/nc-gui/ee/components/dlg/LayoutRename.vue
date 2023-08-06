<script setup lang="ts">
import type { LayoutType, ProjectType } from 'nocodb-sdk'
import type { ComponentPublicInstance } from '@vue/runtime-core'
import {
  Form,
  computed,
  extractSdkResponseErrorMsg,
  message,
  nextTick,
  reactive,
  storeToRefs,
  useI18n,
  useNuxtApp,
  useVModel,
  watchEffect,
} from '#imports'

interface Props {
  modelValue?: boolean
  layout: LayoutType
  dashboardProject: ProjectType
}

const { layout, dashboardProject, ...props } = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'updated'])

const { t } = useI18n()

const { $e, $api } = useNuxtApp()

const dialogShow = useVModel(props, 'modelValue', emit)

const dashboardStore = useDashboardStore()
const { fetchLayouts } = dashboardStore
const { layoutsOfProjects } = storeToRefs(dashboardStore)

const inputEl = $ref<ComponentPublicInstance>()

let loading = $ref(false)

const useForm = Form.useForm

const formState = reactive({
  title: '',
})

const validators = computed(() => {
  return {
    title: [
      {
        validator: (rule: any, value: any) => {
          return new Promise<void>((resolve, reject) => {
            const layoutNameLengthLimit = 255
            const projectPrefix = dashboardProject?.prefix || ''
            if ((projectPrefix + value).length > layoutNameLengthLimit) {
              return reject(new Error(`Layout name exceeds ${layoutNameLengthLimit} characters`))
            }
            resolve()
          })
        },
      },
      {
        validator: (rule: any, value: any) => {
          return new Promise<void>((resolve, reject) => {
            if (/^\s+|\s+$/.test(value)) {
              return reject(new Error('Leading or trailing whitespace not allowed in Layout name'))
            }
            if (
              !(layoutsOfProjects?.value[dashboardProject.id!] || []).every((t) => {
                return t.id === layout.id || t.title.toLowerCase() !== (value || '').toLowerCase()
              })
            ) {
              return reject(new Error('Duplicate layout name'))
            }
            resolve()
          })
        },
      },
    ],
  }
})

const { validateInfos } = useForm(formState, validators)

watchEffect(
  () => {
    if (layout?.title) formState.title = `${layout.title}`

    nextTick(() => {
      const input = inputEl?.$el as HTMLInputElement

      if (input) {
        input.setSelectionRange(0, formState.title.length)
        input.focus()
      }
    })
  },
  { flush: 'post' },
)

const renameLayout = async () => {
  if (!layout) return

  loading = true
  try {
    await $api.dashboard.layoutUpdate(dashboardProject.id!, layout.id as string, {
      ...layout,
      title: formState.title,
    })

    dialogShow.value = false
    await fetchLayouts({ projectId: dashboardProject.id! })

    message.success(t('msg.success.layoutRenamed'))

    $e('a:layout:rename')

    dialogShow.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  loading = false
}
</script>

<template>
  <a-modal
    v-model:visible="dialogShow"
    :class="{ active: dialogShow }"
    :title="$t('activity.renameLayout')"
    :mask-closable="false"
    wrap-class-name="nc-modal-layout-rename"
    @keydown.esc="dialogShow = false"
    @finish="renameLayout"
  >
    <template #footer>
      <a-button key="back" @click="dialogShow = false">{{ $t('general.cancel') }}</a-button>

      <a-button key="submit" type="primary" :loading="loading" @click="renameLayout()">{{ $t('general.submit') }}</a-button>
    </template>

    <div class="pl-10 pr-10 pt-5">
      <a-form :model="formState" name="create-new-layout-form">
        <div class="mb-2">{{ $t('msg.info.enterLayoutName') }}</div>

        <a-form-item v-bind="validateInfos.title">
          <a-input
            ref="inputEl"
            v-model:value="formState.title"
            hide-details
            :placeholder="$t('msg.info.enterLayoutName')"
            @keydown.enter="renameLayout()"
          />
        </a-form-item>
      </a-form>
    </div>
  </a-modal>
</template>
