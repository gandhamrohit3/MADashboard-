import { defineConfig } from 'vite'

export default defineConfig({
  base: '/Hari_Project/',
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: false
  },
  build: {
    outDir: 'dist',
    minify: 'terser'
  }
})
