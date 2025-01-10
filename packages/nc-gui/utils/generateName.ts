export const generateUniqueName = async () => {
  const { adjectives, animals, starWars, uniqueNamesGenerator } = await import('unique-names-generator')

  return uniqueNamesGenerator({
    dictionaries: [[starWars], [adjectives, animals]][Math.floor(Math.random() * 2)],
  })
    .toLowerCase()
    .replace(/[ -]/g, '_')
}

/**
 * Generates a unique title by appending an incremented number if a title with the same name already exists in the array.
 * This can be useful when you need to ensure unique names (e.g., for file names, database entries, etc.) in a list.
 *
 * @template T - The type of items in the array, defaults to a generic record.
 * @param title - The initial title to check for uniqueness.
 * @param arr - The array of objects where the title should be unique.
 * @param predicate - The key of the object to check uniqueness against (e.g., the property of the object that stores the title).
 * @param splitOperator - The character or string used to split the title and the appended number (defaults to `'-'`).
 * @param startFromZero - If `true`, it checks if the title can exist without any appended number and starts counting from 0 (if `false`, it starts from 1).
 * @returns A unique title string, with an appended number if necessary.
 *
 * @example
 * const items = [{ name: 'Project' }, { name: 'Project-1' }];
 * const uniqueTitle = generateUniqueTitle('Project', items, 'name');
 * console.log(uniqueTitle); // 'Project-2'
 */
export const generateUniqueTitle = <T extends Record<string, any> = Record<string, any>>(
  title: string,
  arr: T[],
  predicate: keyof T,
  splitOperator = '-',
  startFromZero = false,
) => {
  // If we start from zero and the title is not already in the array, return the title as is.
  if (startFromZero && !arr.map((item) => item[predicate]).includes(title as T[keyof T])) {
    return title
  }

  // Counter to append to the title if necessary.
  let c = 1

  // Keep incrementing the counter until a unique title is found.
  while (arr.some((item) => item[predicate].includes(`${title}${splitOperator}${c}` as keyof T))) {
    c++
  }

  // Return the unique title with the incremented number appended.
  return `${title}${splitOperator}${c}`
}

export const generateRandomNumber = () => {
  return window.crypto.getRandomValues(new Uint8Array(10)).join('')
}
