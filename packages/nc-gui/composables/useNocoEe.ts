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

  const createTableMagic = async (..._args: any) => {}

  const createSchemaMagic = async (..._args: any) => {}

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
