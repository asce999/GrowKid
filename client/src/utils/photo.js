// P10: a phone photo made smaller on the child's device before it is sent. The server's stripping (rule 5) is still what removes
// location and camera details; this only spares the upload. A video goes as it is.

const LONGEST = 1600
const QUALITY = 0.85

/**
 * The photo to send: at most 1,600 pixels on its longest side, as a JPEG at quality 0.85, when the original is larger than that;
 * otherwise, or for anything that is not a photo, the file as chosen. Turned the right way up first (imageOrientation), since the
 * canvas drops the camera's rotation. If the browser cannot do it, the original goes, and the server still checks it.
 */
export async function shrinkPhoto(file) {
  if (!file?.type?.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = LONGEST / Math.max(bitmap.width, bitmap.height)
    if (scale >= 1) {
      bitmap.close()
      return file
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise((done) => canvas.toBlob(done, 'image/jpeg', QUALITY))
    return blob && blob.size < file.size ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file
  } catch {
    return file
  }
}
