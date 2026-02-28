export function useFileDropToCreateRecords(_options: any) {
  return {
    isProcessing: readonly(ref(false)),
    showFieldSelectDlg: ref(false),
    pendingFiles: readonly(ref<any>([])),
    attachmentFields: computed<any>(() => []),
    handleFileDrop: (_files: any) => {},
    onFieldSelected: (_field: any) => {},
    onFieldSelectCancelled: () => {},
  }
}
