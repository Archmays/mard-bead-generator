import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const [repositoryOwner = '', repositoryName = 'mard-bead-generator'] = (process.env.GITHUB_REPOSITORY ?? '').split('/')
const pagesBase = repositoryName.toLowerCase() === `${repositoryOwner.toLowerCase()}.github.io`
  ? '/'
  : `/${repositoryName}/`

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? pagesBase : '/',
  plugins: [react()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
})
