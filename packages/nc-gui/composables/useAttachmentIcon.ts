export const useAttachmentIcon = (
  title: MaybeRefOrGetter<string | undefined>,
  mimetype: MaybeRefOrGetter<string | undefined>,
) => {
  return computed<keyof typeof iconMap>(() => {
    if (isImage(toValue(title) || '', toValue(mimetype))) {
      return 'ncFileTypeImage'
    }

    if (isPdf(toValue(title) || '', toValue(mimetype))) {
      return 'ncFileTypePdf'
    }

    if (isVideo(toValue(title) || '', toValue(mimetype))) {
      return 'ncFileTypeVideo'
    }

    if (isAudio(toValue(title) || '', toValue(mimetype))) {
      return 'ncFileTypeAudio'
    }

    if (isWord(toValue(title) || '', toValue(mimetype))) {
      return 'ncFileTypeWord'
    }

    if (isExcel(toValue(title) || '', toValue(mimetype))) {
      return 'ncFileTypeCsv'
    }

    if (isPresentation(toValue(title) || '', toValue(mimetype))) {
      return 'ncFileTypePresentation'
    }

    if (isZip(toValue(title) || '', toValue(mimetype))) {
      return 'ncFileTypeZip'
    }

    return 'ncFileTypeUnknown'
  })
}
