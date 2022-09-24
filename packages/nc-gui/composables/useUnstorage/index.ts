import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'

const unstorage = createStorage({
  driver: memoryDriver(),
})

export const useUnstorage = unstorage
