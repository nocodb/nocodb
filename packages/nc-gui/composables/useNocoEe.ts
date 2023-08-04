export const useNocoEe = () => {
  const loadMagic = ref(false)

  const predictColumnType = async (..._args: any) => {}

  const optionsMagic = async (..._args: any) => {}

  const predictFunction = async (..._args: any) => {}

  const predictingNextColumn = ref(false)

  const predictedNextColumn = ref()

  const predictingNextFormulas = ref(false)

  const predictedNextFormulas = ref()

  const predictNextColumn = async (..._args: any) => {}

  const predictNextFormulas = async (..._args: any) => {}

  const createTableMagic = async (_1: Ref<any>, _2: any, _3: any, _4?: (..._args: any) => void) => {}

  const createSchemaMagic = async (_1: Ref<any>, _2: any, _3: any, _4?: (..._args: any) => void) => {}

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
