const rowColorCodes = ['blue', 'green', 'cyan', 'yellow', 'amber', 'red', 'orange', 'purple', 'pink', 'gray']
const rowColorWeights = [200, 300, 500, 700]

export const ROW_COLORS = [
  ...rowColorWeights
    .map((weight) => {
      return rowColorCodes.map((color) => `${color}-${weight}`)
    })
    .reduce((prev, cur) => {
      for (const each of cur) {
        prev.push(each)
      }
      return prev
    }, []),
]