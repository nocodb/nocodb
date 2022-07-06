const imageExt = ['jpeg', 'gif', 'png', 'png', 'svg', 'bmp', 'ico', 'jpg', 'webp']

const isImage = (name: string, mimetype?: string) => {
  return imageExt.some((e) => name?.toLowerCase().endsWith(`.${e}`)) || mimetype?.startsWith('image/')
}

export { isImage, imageExt }
