export const createThumbnail = async (file: File): Promise<string | null> => {
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return null
  return new Promise<string | null>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = function (event) {
      const thumbnailURL = event.target?.result as string
      if (file.type.startsWith('image/')) {
        const img = new Image()
        img.onload = function () {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) return resolve(null)

          const thumbnailWidth = 200
          const scaleFactor = thumbnailWidth / img.width
          const thumbnailHeight = img.height * scaleFactor

          canvas.width = thumbnailWidth
          canvas.height = thumbnailHeight

          ctx.drawImage(img, 0, 0, thumbnailWidth, thumbnailHeight)

          const thumbnailDataURL = canvas.toDataURL('image/png')
          resolve(thumbnailDataURL)
        }
        img.onerror = function () {
          console.error('Error loading image')
          reject(new Error('Error loading image'))
        }
        img.src = thumbnailURL
      } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video')
        video.onloadedmetadata = function () {
          video.currentTime = 1
        }
        video.onseeked = function () {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) return resolve(null)

          const thumbnailWidth = 200
          const scaleFactor = thumbnailWidth / video.videoWidth
          const thumbnailHeight = video.videoHeight * scaleFactor

          canvas.width = thumbnailWidth
          canvas.height = thumbnailHeight

          ctx.drawImage(video, 0, 0, thumbnailWidth, thumbnailHeight)

          const thumbnailDataURL = canvas.toDataURL('image/png')
          resolve(thumbnailDataURL)
        }
        video.onerror = function () {
          console.error('Error loading video')
          reject(new Error('Error loading video'))
        }
        video.src = thumbnailURL
      } else {
        resolve(null)
      }
    }

    reader.onerror = function () {
      console.error('Error reading file')
      reject(new Error('Error reading file'))
    }

    reader.readAsDataURL(file)
  })
}

export async function isURLExpired(url?: string) {
  if (!url) return { isExpired: false, status: 0, error: 'URL is empty' }
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Range: 'bytes=0-0', // Request only the first byte
      },
      cache: 'no-store',
    })

    return {
      isExpired: response.status === 403,
      status: response.status,
    }
  } catch (error) {
    return {
      isExpired: true,
      status: 0,
      error: error.message,
    }
  }
}

export function formatFileSize(bytes?: number, decimals = 2): string {
  if (!ncIsNumber(bytes) || !bytes) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  const size = parseFloat((bytes / k ** i).toFixed(decimals))

  return `${size} ${sizes[i]}`
}

export function getReadableFileType(mimeType?: string): string {
  if (!mimeType || !ncIsString(mimeType)) return ''

  const parts = mimeType.split('/')
  const subtype = parts[1] || ''

  return subtype.toUpperCase()
}
