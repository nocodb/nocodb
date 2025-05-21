import type { TextOrNullType } from 'nocodb-sdk'

export function useTemplatedMessage(
  template: MaybeRefOrGetter<TextOrNullType | undefined>,
  options: MaybeRefOrGetter<Record<string, any>>,
) {
  const message = computed(() => {
    const temp = toValue(template)
    const opts = toValue(options)

    if (!temp?.trim()) {
      return ''
    }

    let res = temp

    for (const entry of Object.entries(opts)) {
      res = res.replace(new RegExp(`{\\s*${entry[0]}\\s*}`, 'g'), entry[1])
    }

    return res
  })

  return {
    message,
  }
}
