export const generateUniqueName = async () => {
  const { adjectives, animals, starWars, uniqueNamesGenerator } = await import('unique-names-generator')

  return uniqueNamesGenerator({
    dictionaries: [[starWars], [adjectives, animals]][Math.floor(Math.random() * 2)],
  })
    .toLowerCase()
    .replace(/[ -]/g, '_')
}

export const generateUniqueTitle = <T extends Record<string, any> = Record<string, any>>(
  title: string,
  arr: T[],
  predicate: keyof T,
) => {
  let c = 1
  while (arr.some((item) => item[predicate].includes(`${title}-${c}` as keyof T))) {
    c++
  }

  return `${title}-${c}`
}
