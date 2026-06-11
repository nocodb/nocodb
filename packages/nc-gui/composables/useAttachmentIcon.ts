export const useAttachmentIcon = (
  title: MaybeRefOrGetter<string | undefined>,
  mimetype: MaybeRefOrGetter<string | undefined>,
) => {
  return computed<keyof typeof iconMap>(() => {
    return getAttachmentIcon(title, mimetype)
  })
}
