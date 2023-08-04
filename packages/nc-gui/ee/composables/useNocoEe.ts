import type { ColumnType, ProjectType, TableType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'

export const useNocoEe = () => {
  const { $api, $e } = useNuxtApp()

  const { refreshCommandPalette } = useCommandPalette()

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
    project: Ref<ProjectType>,
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
          schema: project.value?.title,
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

  const predictNextColumn = async (meta: Ref<TableType>) => {
    if (predictingNextColumn.value) return
    predictedNextColumn.value = []
    predictingNextColumn.value = true
    try {
      if (meta.value && meta.value.columns) {
        const res: { data: Array<{ title: string; type: string }> } = await $api.utils.magic({
          operation: 'predictNextColumn',
          data: {
            table: meta.value.title,
            columns: meta.value.columns.map((col) => col.title),
          },
        })

        predictedNextColumn.value = res.data
      }
    } catch (e) {
      message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
    }
    predictingNextColumn.value = false
  }

  const predictNextFormulas = async (meta: Ref<TableType>) => {
    if (predictingNextFormulas.value) return
    predictingNextFormulas.value = true
    try {
      if (meta.value && meta.value.columns) {
        const res: { data: Array<{ title: string; formula: string }> } = await $api.utils.magic({
          operation: 'predictNextFormulas',
          data: {
            table: meta.value.title,
            columns: meta.value.columns
              .filter((c) => {
                // skip system LTAR columns
                if (c.uidt === UITypes.LinkToAnotherRecord && c.system) return false
                if ([UITypes.QrCode, UITypes.Barcode].includes(c.uidt as UITypes)) return false
                return true
              })
              .map((col) => col.title),
          },
        })

        predictedNextFormulas.value = res.data
      }
    } catch (e) {
      message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
    }
    predictingNextFormulas.value = false
  }

  const createTableMagic = async (
    project: Ref<ProjectType>,
    baseId: string,
    table: TableType,
    onTableCreate?: (t: TableType) => void,
  ) => {
    try {
      const tableMeta = await $api.base.tableMagic(project?.value?.id as string, baseId as string, {
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
    project: Ref<ProjectType>,
    baseId: string,
    table: TableType,
    onTableCreate?: (t: TableType) => void,
  ) => {
    try {
      const tableMeta = await $api.base.schemaMagic(project?.value?.id as string, baseId as string, {
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
