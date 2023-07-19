<script lang="ts" setup>
import type { Ref } from 'vue'
import type { ModalFuncProps, SelectProps } from 'ant-design-vue'
import type { ColumnType } from 'nocodb-sdk'
import { message } from 'ant-design-vue'
import { storeToRefs } from 'pinia'
import MdiHammer from '~icons/mdi/hammer'
import { useNuxtApp, useProject, useSqlEditor, useUIPermission } from '#imports'

const { bases, tables } = storeToRefs(useProject())

const router = useRouter()

const route = useRoute()

const { metas, getMeta } = useMetas()

const { isUIAllowed } = useUIPermission()

const { $api, $e } = useNuxtApp()

const { sqlEditors, promptHistory } = useSqlEditor()

const base = computed(() => bases.value.find((el) => el.id === route.params?.baseId) || bases.value.filter((el) => el.enabled)[0])

const activeSqlEditor = computed(() => {
  if (!base.value?.id) return { sqlPrompt: '', rawSql: '' }
  if (base.value?.id && base.value.id in sqlEditors.value) {
    return sqlEditors.value[base.value.id]
  } else {
    sqlEditors.value[base.value.id] = { sqlPrompt: '', rawSql: '' }
    return sqlEditors.value[base.value.id]
  }
})

const activePrompt = computed(() =>
  promptHistory.find((p) => base.value?.id === p.baseId && p.prompt === activeSqlEditor.value.sqlPrompt),
)

const historyDrawer = ref(false)

const loadMagic = ref(false)

const loadSQL = ref(false)

const baseOptions = computed((): SelectProps['options'] => bases.value.map((b) => ({ label: b.alias || 'Default', value: b.id })))

const dataQuery: Ref<string> = ref('')

const data: Ref<Record<string, any>[]> = ref([])

const columns: Ref<any[]> = ref([])

const handleResizeColumn = (w: number, col: any) => {
  col.width = w
}

const loadPrompt = (pr: { prompt: string; query?: string }) => {
  activeSqlEditor.value.sqlPrompt = pr.prompt
  activeSqlEditor.value.rawSql = pr.query || ' '
}

const addHistory = (prompt: string, query: string, status: boolean | null = null, error = '') => {
  if (!prompt.length || !base.value.id) return
  const fnd = promptHistory.find((p) => p.baseId === base.value.id && p.prompt === prompt)
  if (fnd) {
    fnd.query = query
    fnd.status = status
    fnd.error = error
    promptHistory.splice(promptHistory.indexOf(fnd), 1)
    promptHistory.unshift(fnd)
  } else {
    promptHistory.unshift({ baseId: base.value.id, prompt, query, status, error })
  }
}

const generateSQL = async () => {
  if (!isUIAllowed('sqlEditorAi') || loadMagic.value) return
  if (!activeSqlEditor.value.sqlPrompt.length) return message.warning('Please enter a prompt first!')

  loadMagic.value = true

  const baseTables = tables.value.filter((t) => t.base_id === base.value.id && t.type === 'table' && t.table_name)

  for (const table of baseTables) {
    if (table.id && !metas.value[table.id]) await getMeta(table.id)
  }

  if (!base) return

  const req = {
    prompt: activeSqlEditor.value.sqlPrompt,
    base: {
      type: base.value.type,
      tables: baseTables.map((t) => ({
        title: t.table_name,
        columns: ((t.id && metas.value[t.id].columns.filter((c: ColumnType) => c.column_name)) || []).map((c: ColumnType) => ({
          title: c.column_name,
        })),
      })),
    },
  }

  await $api.utils
    .magic({
      operation: 'generateSQL',
      data: req,
    })
    .then((res: { data: Array<{ description: string; query: string }> }) => {
      if (res.data.length === 1) {
        activeSqlEditor.value.rawSql = res.data[0].query
        addHistory(activeSqlEditor.value.sqlPrompt, activeSqlEditor.value.rawSql)
      } else {
        for (const q of res.data.reverse()) {
          addHistory(q.description, q.query)
        }
        loadPrompt(promptHistory[0])
      }
    })
    .catch(async (e) => {
      message.error(await extractSdkResponseErrorMsg(e))
    })
    .finally(() => {
      loadMagic.value = false
    })
}

const generatePrompt = async (mode: 'KPI' | 'dashboard', max = 5) => {
  if (!isUIAllowed('sqlEditorAi') || loadMagic.value) return

  loadMagic.value = true

  const baseTables = tables.value.filter((t) => t.base_id === base.value.id && t.type === 'table' && t.table_name)

  for (const table of baseTables) {
    if (table.id && !metas.value[table.id]) await getMeta(table.id)
  }

  if (!base) return

  const req = {
    prompt: mode,
    max,
    base: {
      type: base.value.type,
      tables: baseTables.map((t) => ({
        title: t.table_name,
        columns: ((t.id && metas.value[t.id].columns.filter((c: ColumnType) => c.column_name)) || []).map((c: ColumnType) => ({
          title: c.column_name,
        })),
      })),
    },
  }

  await $api.utils
    .magic({
      operation: 'generateQueryPrompt',
      data: req,
    })
    .then((res) => {
      for (const p of res.data) {
        addHistory(p.description, p.query)
      }
      if (!activeSqlEditor.value.sqlPrompt.length) loadPrompt(promptHistory[0])
      historyDrawer.value = true
    })
    .catch(async (e) => {
      message.error(await extractSdkResponseErrorMsg(e))
    })
    .finally(() => {
      loadMagic.value = false
    })
}

const repairSQL = async () => {
  if (!isUIAllowed('sqlEditorAi') || loadSQL.value) return

  loadSQL.value = true

  const baseTables = tables.value.filter((t) => t.base_id === base.value.id && t.type === 'table' && t.table_name)

  for (const table of baseTables) {
    if (table.id && !metas.value[table.id]) await getMeta(table.id)
  }

  if (!base) return

  const req = {
    sql: activeSqlEditor.value.rawSql,
    base: {
      type: base.value.type,
      tables: baseTables.map((t) => ({
        title: t.table_name,
        columns: ((t.id && metas.value[t.id].columns.filter((c: ColumnType) => c.column_name)) || []).map((c: ColumnType) => ({
          title: c.column_name,
        })),
      })),
    },
  }

  await $api.utils
    .magic({
      operation: 'repairSQL',
      data: req,
    })
    .then((res) => {
      addHistory(activeSqlEditor.value.sqlPrompt, res.data.query)
      activeSqlEditor.value.rawSql = res.data.query
    })
    .catch(async (e) => {
      message.error(await extractSdkResponseErrorMsg(e))
    })
    .finally(() => {
      loadSQL.value = false
    })
}

const repairModal = (e?: string) => {
  loadSQL.value = false
  Modal.confirm({
    title: `Do you want to repair the query?`,
    content: h('div', {}, [
      h('p', {}, 'The query is not valid. Please repair it before running.'),
      h('p', { style: { 'margin': 0, 'font-weight': 600 } }, 'Error:'),
      h(
        'pre',
        { class: 'bg-slate-50 overflow-auto scrollbar-thin-dull p-4 border-1 border-slate-200 select-text' },
        h('code', { style: { margin: 0 } }, e),
      ),
    ]),
    type: 'warn',
    width: '50%',
    okText: 'Repair',
    okButtonProps: {
      type: 'primary',
      icon: h(MdiHammer, { class: 'mr-2' }, ''),
    },
    onOk: async () => {
      await repairSQL()
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      await runSQL()
    },
    cancelText: 'Skip',
    maskClosable: true,
    confirmLoading: loadSQL.value,
  } as ModalFuncProps)
}

const runSQL = async () => {
  if (!isUIAllowed('sqlEditor') || loadSQL.value) return

  if (activePrompt.value?.status === false) return await repairModal(activePrompt.value?.error)

  loadSQL.value = true

  await $api.utils
    .selectQuery({
      baseId: base.value.id,
      query: activeSqlEditor.value.rawSql,
    })
    .then((res: { data: Record<string, any>[] }) => {
      addHistory(activeSqlEditor.value.sqlPrompt, activeSqlEditor.value.rawSql, true)
      dataQuery.value = activeSqlEditor.value.rawSql
      data.value = Array.isArray(res.data) ? res.data : []
    })
    .catch(async (e) => {
      const error_msg = await extractSdkResponseErrorMsg(e)
      addHistory(activeSqlEditor.value.sqlPrompt, activeSqlEditor.value.rawSql, false, error_msg)
      await repairModal(error_msg)
    })
    .finally(() => {
      loadSQL.value = false
    })
}

function openSqlViewCreateDialog(baseId?: string) {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgSqlViewCreate'), {
    'modelValue': isOpen,
    'baseId': baseId || bases.value[0].id,
    'title': activePrompt.value?.prompt,
    'sql': dataQuery.value,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

watch(
  () => Object.keys(data.value[0] || {}),
  (keys) => {
    if (!data.value.length) {
      columns.value = []
      return
    }
    for (const key of keys) {
      if (!columns.value.find((c) => c.dataIndex === key)) {
        columns.value.push({
          title: key,
          dataIndex: key,
          resizable: true,
          ellipsis: true,
        })
      }
    }
    columns.value = columns.value.filter((c) => keys.includes(c.dataIndex))
  },
  { immediate: true },
)

const changeBase = (baseId?: string) => {
  if (baseId) {
    const base = bases.value.find((b) => b.id === baseId)
    if (base) {
      router.replace({ params: { baseId: base.id } })
    } else {
      router.replace({ params: { baseId: bases.value[0].id } })
    }
  }
}

watch(
  () => route.params.baseId,
  (baseId) => {
    until(bases)
      .toMatch((bases) => bases.length > 0)
      .then(() => {
        changeBase(baseId as string)
      })
  },
  { immediate: true },
)
</script>

<template>
  <div class="grid grid-cols-12 h-full">
    <div class="flex flex-col h-full w-full text-gray-60" :class="[historyDrawer ? 'col-span-9' : 'col-span-12']">
      <div class="flex flex-col h-[500px]">
        <div class="flex p-4">
          <a-select
            :value="base?.id"
            :options="baseOptions"
            class="w-[200px] !mr-4"
            @change="(v, o) => changeBase(v as string)"
          />
          <a-dropdown-button class="!mr-4" @click="generateSQL()">
            Generate Query
            <template #overlay>
              <a-menu>
                <a-menu-item key="genKPI" @click="generatePrompt('KPI')">
                  <div class="cursor-pointer flex items-center py-2">
                    <MdiLayersTriple class="mr-1 mt-[1px] text-orange-400 text-lg" />
                    <div class="text-sm xl:text-md">Show me 5 possible KPI queries</div>
                  </div>
                </a-menu-item>
                <a-menu-item key="genDASH" @click="generatePrompt('dashboard')">
                  <div class="cursor-pointer flex items-center py-2">
                    <MdiLayersTriple class="mr-1 mt-[1px] text-blue-400 text-lg" />
                    <div class="text-sm xl:text-md">Show me 5 possible dashboard queries</div>
                  </div>
                </a-menu-item>
              </a-menu>
            </template>
            <template #icon
              ><GeneralIcon icon="magic" :class="{ 'nc-animation-pulse': loadMagic }" class="text-orange-400"
            /></template>
          </a-dropdown-button>
          <a-button
            type="primary"
            class="!flex items-center"
            :loading="loadSQL"
            :disabled="!activeSqlEditor.rawSql?.length"
            @click="runSQL"
          >
            <template #icon><MdiPlay class="mr-1" /></template>
            Run
          </a-button>
          <MdiHistory
            v-if="loadMagic || promptHistory.filter((p) => p.baseId === base?.id).length"
            id="history"
            class="my-auto ml-2 text-xl text-gray-400 cursor-pointer"
            :class="{ 'animate-spin': loadMagic }"
            @click="() => (historyDrawer = !historyDrawer)"
          />
        </div>
        <div class="flex w-full items-center p-4">
          <a-input
            v-model:value="activeSqlEditor.sqlPrompt"
            placeholder="Enter your plain prompt here"
            style="width: 100%"
            :bordered="false"
            :disabled="loadMagic || loadSQL"
          ></a-input>
        </div>
        <div class="flex-1 w-full">
          <LazyMonacoEditor
            v-model="activeSqlEditor.rawSql"
            class="w-full h-full"
            lang="sql"
            :hide-minimap="true"
            :read-only="loadSQL"
            @input="activePrompt && activePrompt.status === false && (activePrompt.status = null)"
          />
        </div>
      </div>
      <div class="flex-1 bg-slate-50 p-4">
        <a-table
          :data-source="data"
          :columns="columns"
          bordered
          :pagination="{ pageSize: 25 }"
          @resize-column="handleResizeColumn"
        />
        <a-button
          v-if="dataQuery && data.length"
          type="primary"
          class="!flex items-center absolute z-5 bottom-[50px]"
          @click="openSqlViewCreateDialog(base?.id)"
        >
          <MdiEyeCircleOutline class="mr-2" />
          Create SQL View
        </a-button>
      </div>
    </div>
    <div
      v-if="historyDrawer"
      class="overflow-y-scroll scrollbar-thin-dull"
      :class="[historyDrawer ? 'col-span-3' : 'col-span-0']"
    >
      <div class="flex p-4">
        <a-steps progress-dot :current="-1" direction="vertical" size="small">
          <a-step
            v-for="pr of promptHistory.filter((p) => p.baseId === base?.id)"
            :key="pr.prompt"
            :class="{ 'ant-steps-item-worked': pr.status && activePrompt?.prompt !== pr.prompt }"
            :status="pr.status === false ? 'error' : activePrompt?.prompt === pr.prompt ? 'process' : 'wait'"
            @click="loadPrompt(pr)"
          >
            <template #title>
              <text-clamp :key="pr.prompt" class="w-full h-full break-all" :text="`${pr.prompt || ' '}`" :max-lines="1" />
            </template>
            <template #description>
              <text-clamp
                :key="activePrompt?.prompt"
                class="w-full h-full break-all"
                :text="`${pr.query || ' '}`"
                :max-lines="2"
              />
            </template>
          </a-step>
        </a-steps>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-select-selection-search-input) {
  @apply !text-xs;
}
:deep(.ant-steps-item-description) {
  @apply !text-xs !text-gray-400;
}
:deep(.ant-steps-item-worked .ant-steps-item-icon) {
  background-color: #fff;
  border-color: #22ff22;
}

:deep(.ant-steps-item-worked .ant-steps-item-icon > .ant-steps-icon) {
  color: #22ff22;
}

:deep(.ant-steps-item-worked .ant-steps-item-icon > .ant-steps-icon .ant-steps-icon-dot) {
  background: #22ff22;
}
</style>
