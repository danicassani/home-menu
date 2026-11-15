import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
export default defineConfig({ plugins: [react(), tailwind()], test: { exclude: [...configDefaults.exclude, 'e2e/**'], environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], clearMocks: true } });
