/**
 * 记录图片管理 — 选择、压缩、预览
 * H1: 图片附件功能
 */
import { ref } from 'vue'

export function useDiaryImages(formRef) {
  const MAX_IMAGES = 9
  const MAX_SIZE = 1024 // px
  const QUALITY = 80

  function getImages() { return formRef.value.images || (formRef.value.images = []) }

  async function chooseImage() {
    const current = getImages()
    const remaining = MAX_IMAGES - current.length
    if (remaining <= 0) {
      uni.showToast({ title: `最多 ${MAX_IMAGES} 张`, icon: 'none' })
      return
    }
    try {
      const res = await new Promise((resolve, reject) => {
        uni.chooseImage({
          count: remaining,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject
        })
      })
      const newImages = await Promise.all(res.tempFilePaths.map(path => compressImage(path)))
      formRef.value.images = [...current, ...newImages.filter(Boolean)]
    } catch (e) {
      // 用户取消不算错
      if (e?.errMsg?.includes('cancel')) return
      uni.showToast({ title: '选择图片失败', icon: 'none' })
    }
  }

  function removeImage(idx) {
    const images = getImages()
    images.splice(idx, 1)
  }

  function previewImage(idx) {
    const images = getImages()
    uni.previewImage({ current: images[idx], urls: images })
  }

  async function compressImage(filePath) {
    return new Promise((resolve) => {
      uni.compressImage({
        src: filePath,
        quality: QUALITY,
        compressedWidth: MAX_SIZE,
        success: (res) => resolve(res.tempFilePath),
        fail: () => resolve(filePath) // 压缩失败用原图
      })
    })
  }

  return { chooseImage, removeImage, previewImage, MAX_IMAGES }
}
