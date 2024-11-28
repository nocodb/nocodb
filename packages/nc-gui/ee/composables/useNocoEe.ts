import type { BaseType, ColumnType, TableType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'

export const useNocoEe = () => {
  const { $api, $e } = useNuxtApp()

  const { refreshCommandPalette } = useCommandPalette()

  const { predictNextFields, predictNextFormulas: _predictNextFormulas } = useNocoAi()

  const loadMagic = ref(false)

  const predictColumnType = async (formState: Ref<Record<string, any>>, onUidtOrIdTypeChange: () => void) => {
    if (loadMagic.value) return
    try {
      loadMagic.value = true
      const predictRes = await $api.utils.magic({
        operation: 'predictColumnType',
        data: {
          title: formState.value.title,
        },
      })
      const predictType = predictRes?.data
      if (predictType && Object.values(UITypes).includes(predictType)) {
        formState.value.uidt = predictType
        onUidtOrIdTypeChange()
      }
    } catch (e) {
      message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
    }
    loadMagic.value = false
  }

  const optionsMagic = async (
    base: Ref<BaseType>,
    formState: Ref<Record<string, any>>,
    getNextColor: () => string,
    options: any[],
    renderedOptions: any[],
  ) => {
    if (loadMagic.value) return
    try {
      loadMagic.value = true
      const res: Array<string> = await $api.utils.magic({
        operation: 'selectOptions',
        data: {
          schema: base.value?.title,
          title: formState.value?.title,
          table: formState.value?.table_name,
        },
      })

      if (res.length) {
        for (const op of res) {
          const option = {
            title: op,
            color: getNextColor(),
          }
          options.push(option)
          renderedOptions.push(option)
        }
      }
    } catch (e) {
      message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
    }
    loadMagic.value = false
  }

  const predictFunction = async (
    formState: Ref<Record<string, any>>,
    meta: Ref<TableType>,
    supportedColumns: Ref<ColumnType[]>,
    suggestionsList: Ref<any[]>,
    vModel: Ref<any>,
  ) => {
    if (loadMagic.value) return
    try {
      loadMagic.value = true
      const res: { data: string } = await $api.utils.magic({
        operation: 'predictFormula',
        data: {
          title: formState.value?.title,
          table: meta.value?.title,
          columns: supportedColumns.value.map((c) => c.title),
          functions: suggestionsList.value.filter((f) => f.type === 'function').map((f) => f.text),
        },
      })

      if (res.data) {
        vModel.value.formula_raw = res.data
      }
    } catch (e) {
      message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
    }
    loadMagic.value = false
  }

  const predictingNextColumn = ref(false)

  const predictedNextColumn = ref<Array<{ title: string; type: string }>>()

  const predictingNextFormulas = ref(false)

  const predictedNextFormulas = ref<Array<{ title: string; formula: string }>>()

  const predictNextColumn = async (tableId: string) => {
    if (predictingNextColumn.value) return
    predictedNextColumn.value = []
    predictingNextColumn.value = true
    try {
      const res = await predictNextFields(tableId)

      predictedNextColumn.value = res
    } catch (e) {
      message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
    }
    predictingNextColumn.value = false
  }

  const predictNextFormulas = async (tableId: string) => {
    if (predictingNextFormulas.value) return
    predictedNextFormulas.value = []
    predictingNextFormulas.value = true
    try {
      const res = await _predictNextFormulas(tableId)

      predictedNextFormulas.value = res
    } catch (e) {
      message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
    }
    predictingNextFormulas.value = false
  }

  const createTableMagic = async (
    base: Ref<BaseType>,
    sourceId: string,
    table: { title: string; table_name: string; columns: string[] },
    onTableCreate?: (t: TableType) => void,
  ) => {
    try {
      const tableMeta = await $api.source.tableMagic(base?.value?.id as string, sourceId as string, {
        table_name: table.table_name,
        title: table.title,
      })

      $e('a:table:create')
      onTableCreate?.(tableMeta as TableType)
      refreshCommandPalette()
    } catch (e: any) {
      message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
    }
  }

  const createSchemaMagic = async (
    base: Ref<BaseType>,
    sourceId: string,
    table: { title: string; table_name: string; columns: string[] },
    onTableCreate?: (t: TableType) => void,
  ) => {
    try {
      const tableMeta = await $api.source.schemaMagic(base?.value?.id as string, sourceId as string, {
        schema_name: table.table_name,
        title: table.title,
      })

      $e('a:table:create')
      onTableCreate?.(tableMeta as TableType)
      refreshCommandPalette()
    } catch (e: any) {
      message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
    }
  }

  return {
    loadMagic,
    predictColumnType,
    optionsMagic,
    predictFunction,
    table: {
      predictingNextColumn,
      predictedNextColumn,
      predictNextColumn,
      predictingNextFormulas,
      predictedNextFormulas,
      predictNextFormulas,
    },
    createTableMagic,
    createSchemaMagic,
  }
}
