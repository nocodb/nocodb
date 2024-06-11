import { UITypes } from 'nocodb-sdk'

class Field {
  id
  name
  pattern

  constructor(id: number, name: string, pattern: RegExp | null) {
    this.name = name
    this.id = id
    this.pattern = pattern
  }

  valueOf() {
    return this.id
  }

  toString() {
    return this.name
  }

  isSubsetOf(id: number) {
    return this.id & id && this.id < id
  }

  isMatch(input: string) {
    return this.pattern?.test(input)
  }
}

const TYPES = [
  new Field(0b00000000000000001, UITypes.LongText, /.*/),
  new Field(0b00000000000000011, UITypes.SingleLineText, /.*/),
  new Field(0b00000000000000111, UITypes.PhoneNumber, /\+?d{10,13}/),
  new Field(0b00000000000001011, UITypes.URL, /https?:\/\/.*/),
  new Field(0b00000000000011011, UITypes.Email, /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/),
].sort()

export function infer(input: string) {
  const result = []
  let typeCode = 0

  for (const type of TYPES) {
    if (type.isSubsetOf(typeCode) || type.isMatch(input)) {
      result.push(type)
      typeCode |= type.id
    }
  }
  return result
}
