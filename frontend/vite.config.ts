import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174, // Remplace par le port que tu veux
    strictPort: true, // Optionnel : empêche Vite de chercher un autre port si le 5174 est pris
  },
})
