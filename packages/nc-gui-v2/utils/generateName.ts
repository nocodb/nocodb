import { adjectives, animals, starWars, uniqueNamesGenerator } from 'unique-names-generator'

export const generateUniqueName = () => {
  return uniqueNamesGenerator({
    dictionaries: [[starWars], [adjectives, animals]][Math.floor(Math.random() * 2)],
  })
    .toLowerCase()
    .replace(/[ -]/g, '_')
}
