import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue()
  ],
  base: './',
  build: {
    // Distribution folder
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  // Static files
  publicDir: 'public'
})
