import { defineConfig } from 'vite'
import { resolve } from 'path'
import { copyFileSync } from 'fs'

// Compilamos dos bundles con dos runs de Vite:
// 1. content.js  (IIFE, sin React)
// 2. popup.js + popup.html (copiados tal cual a dist/)
//
// Para simplificar usamos un único build de librería para content.js
// y copiamos el popup manualmente con el plugin copy.

function copyPopupPlugin() {
  return {
    name: 'copy-popup',
    closeBundle() {
      copyFileSync('src/popup/popup.html', 'dist/popup.html')
      copyFileSync('src/popup/popup.js',   'dist/popup.js')
      copyFileSync('src/crossfade-settings.js', 'dist/crossfade-settings.js')
    }
  }
}

export default defineConfig({
  plugins: [copyPopupPlugin()],
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: 'src/content/index.jsx',
      formats: ['iife'],
      name: 'naranjam',
      fileName: () => 'content.js'
    },
    rollupOptions: {
      external: []
    },
    sourcemap: false,
    minify: true
  }
})
