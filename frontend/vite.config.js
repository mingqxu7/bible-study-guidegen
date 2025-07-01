import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true, // This will make Vite fail if port 3000 is in use, instead of trying another port
    open: true,
    host: 'localhost'
  }
})