import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
    ],
    build: {
        target: 'esnext',
        minify: 'esbuild',
        chunkSizeWarningLimit: 700,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) return;
                    if (id.includes('node_modules/three/examples/jsm')) return 'three-examples';
                    if (id.includes('node_modules/three')) return 'three-core';
                    if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react-vendor';
                    if (id.includes('node_modules/@tailwindcss') || id.includes('node_modules/tailwindcss')) return 'tailwind-vendor';
                }
            }
        }
    },
    optimizeDeps: {
        include: ['three', 'react', 'react-dom']
    }
})