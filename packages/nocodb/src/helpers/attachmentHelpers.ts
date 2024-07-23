import mime from 'mime/lite';

const previewableMimeTypes = ['image', 'pdf', 'video', 'audio'];

export function isPreviewAllowed(args: { mimetype?: string; path?: string }) {
  const { mimetype, path } = args;

  if (mimetype) {
    return previewableMimeTypes.some((type) => mimetype.includes(type));
  } else if (path) {
    const ext = path.split('.').pop();
    if (ext) {
      const mimeType = mime.getType(ext);
      return previewableMimeTypes.some((type) => mimeType?.includes(type));
    }
  }

  return false;
}
