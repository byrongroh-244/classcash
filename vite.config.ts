import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

// BASE_PATH is set by the GitHub Actions workflow to "/<repo-name>/", so the
// repo can be named anything without editing this file. Locally it's "/".
export default defineConfig({
  plugins: [
    react(),
    legacy({ targets: ['ios >= 12'] }),
  ],
  base: process.env.BASE_PATH || '/',
})
