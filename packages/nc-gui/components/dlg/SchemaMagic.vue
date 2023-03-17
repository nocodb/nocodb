<script setup lang="ts">
import { Form, computed, nextTick, onMounted, ref, useProject, useTable, useVModel, validateTableName } from '#imports'

const props = defineProps<{
  modelValue: boolean
  baseId: string
}>()

const emit = defineEmits(['update:modelValue'])

const dialogShow = useVModel(props, 'modelValue', emit)

const inputEl = ref<HTMLInputElement>()

const { loadTables, isMysql, isMssql, isPg } = useProject()

const { table, createSchemaMagic, generateUniqueTitle, tables, project } = useTable(async () => {
  await loadTables()
  dialogShow.value = false
}, props.baseId)

const useForm = Form.useForm

const loadMagic = ref(false)

const validators = computed(() => {
  return {
    title: [
      validateTableName,
      {
        validator: (_: any, value: any) => {
          // validate duplicate alias
          return new Promise((resolve, reject) => {
            if ((tables.value || []).some((t) => t.title === (value || ''))) {
              return reject(new Error('Duplicate table alias'))
            }
            return resolve(true)
          })
        },
      },
      {
        validator: (rule: any, value: any) => {
          return new Promise<void>((resolve, reject) => {
            let tableNameLengthLimit = 255
            if (isMysql(props.baseId)) {
              tableNameLengthLimit = 64
            } else if (isPg(props.baseId)) {
              tableNameLengthLimit = 63
            } else if (isMssql(props.baseId)) {
              tableNameLengthLimit = 128
            }
            const projectPrefix = project?.value?.prefix || ''
            if ((projectPrefix + value).length > tableNameLengthLimit) {
              return reject(new Error(`Table name exceeds ${tableNameLengthLimit} characters`))
            }
            resolve()
          })
        },
      },
    ],
    table_name: [validateTableName],
  }
})

const { validate, validateInfos } = useForm(table, validators)

const _createTable = async () => {
  try {
    await validate()
  } catch (e: any) {
    e.errorFields.map((f: Record<string, any>) => message.error(f.errors.join(',')))
    if (e.errorFields.length) return
  }
  loadMagic.value = true
  await createSchemaMagic()
  loadMagic.value = false
}

onMounted(() => {
  generateUniqueTitle()
  table.title = ''
  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
  })
})
</script>

<template>
  <a-modal
    v-model:visible="dialogShow"
    :class="{ active: dialogShow }"
    width="max(30vw, 600px)"
    centered
    wrap-class-name="nc-modal-table-create"
    @keydown.esc="dialogShow = false"
  >
    <template #footer>
      <a-button key="back" size="large" @click="dialogShow = false">{{ $t('general.cancel') }}</a-button>

      <a-button key="submit" size="large" :loading="loadMagic" type="primary" @click="_createTable">{{ $t('general.submit') }}</a-button>
    </template>

    <div class="pl-10 pr-10 pt-5">
      <a-form :model="table" name="create-new-table-form" @keydown.enter="_createTable">
        <!-- Create A New Table -->
        <div class="flex prose-xl font-bold self-center my-4 items-center">
          Create schema using <PhSparkleFill :class="{ 'nc-animation-pulse': loadMagic }" class="ml-2 text-orange-400" />
        </div>

        <!-- hint="Enter table name" -->
        <!--        Table name -->
        <div class="mb-2">Schema for</div>

        <a-form-item v-bind="validateInfos.title">
          <a-input
            ref="inputEl"
            v-model:value="table.title"
            size="large"
            hide-details
            data-testid="create-table-title-input"
            placeholder="Enter schema name"
          />
        </a-form-item>
      </a-form>
    </div>
  </a-modal>
</template>

<style scoped lang="scss">
.nc-table-advanced-options {
  max-height: 0;
  transition: 0.3s max-height;
  overflow: hidden;

  &.active {
    max-height: 200px;
  }
}
</style>
