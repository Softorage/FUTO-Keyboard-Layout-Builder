import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  // base export is required if the url is at a slug
  base: '/FUTO-Keyboard-Layout-Builder/', 
})