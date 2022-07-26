<script setup lang="ts">
import { inject } from '@vue/runtime-core'
import type { TableType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { ActiveViewInj, MetaInj, ViewListInj } from '~/context'
import useViewCreate from '~/composables/useViewCreate'

const { modelValue, type } = defineProps<{ type: ViewTypes; modelValue: boolean }>()

const emit = defineEmits(['update:modelValue', 'created'])

const valid = ref(false)

const viewList = inject(ViewListInj)

const activeView = inject(ActiveViewInj)

const inputEl = ref()

const form = ref()

const dialogShow = computed({
  get() {
    return modelValue
  },
  set(v) {
    emit('update:modelValue', v)
  },
})

const { view, createView, generateUniqueTitle, loading } = useViewCreate(inject(MetaInj) as Ref<TableType>, (view) =>
  emit('created', view),
)

const typeAlias = computed(
  () =>
    ({
      [ViewTypes.GRID]: 'grid',
      [ViewTypes.GALLERY]: 'gallery',
      [ViewTypes.FORM]: 'form',
      [ViewTypes.KANBAN]: 'kanban',
    }[type]),
)

watch(
  () => modelValue,
  (v) => {
    if (v) {
      generateUniqueTitle(viewList?.value || [])
      nextTick(() => {
        const el = inputEl?.value?.$el
        el?.querySelector('input')?.focus()
        el?.querySelector('input')?.select()
        form?.value?.validate()
      })
    }
  },
)

const onSubmit = () => {
  const isValid = form.value.validate()
  if (isValid) {
    createView(view.type!)
    emit('update:modelValue', false)
  }
}
</script>

<template>
  <a-modal v-model:visible="dialogShow">
    <template #title>
      {{ $t('general.create') }} <span class="text-capitalize">{{ typeAlias }}</span> {{ $t('objects.view') }}
    </template>
    <a-form ref="form" layout="vertical" :model="valid" name="createView" @finish="createView">
      <a-form-item
        :label="$t('labels.viewName')"
        :name="$t('labels.viewName')"
        :rules="[{ required: true, message: 'View name required' }]"
      >
        <a-input ref="inputEl" v-model:value="view.title" autofocus />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
