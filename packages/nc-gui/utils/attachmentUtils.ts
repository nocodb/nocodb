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
          reject(null)
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
          reject(null)
        }
        video.src = thumbnailURL
      } else {
        resolve(null)
      }
    }

    reader.onerror = function () {
      console.error('Error reading file')
      reject(null)
    }

    reader.readAsDataURL(file)
  })
}
