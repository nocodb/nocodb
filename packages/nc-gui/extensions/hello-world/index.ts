import { h } from '#imports'

export default (...args: any[]) => {
  return h('div', `Hello world! This is project ${args[0]}`)
}
