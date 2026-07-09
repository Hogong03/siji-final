import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
  plugins: [uni()],
  resolve: {
    alias: {
      '@': '/'
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/uni.scss";`
      }
    }
  }
})
