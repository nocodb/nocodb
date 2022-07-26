import { adjectives, animals, starWars, uniqueNamesGenerator } from 'unique-names-generator'

export const generateUniqueName = () => {
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
  while (arr.some((item) => item[predicate] === (`${title}-${c}` as keyof T))) {
    c++
  }

  return `${title}-${c}`
}
