import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: "/content-bridge-architecture/",
  plugins: [react()],
});