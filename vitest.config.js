import { resolve } from 'path'

// vitest 配置（无需 import vitest/config，通过 vite config 的 test 字段）
export default {
  resolve: {
    alias: {
      '@': resolve(process.cwd(), '.')
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js']
  }
}
