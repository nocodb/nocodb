// todo: implement useAttachment
export function useAttachment() {
  const localFilesState = reactive([])
  const attachments = ref([])

  const uploadFile = () => {}

  return { uploadFile, localFilesState, attachments }
}
