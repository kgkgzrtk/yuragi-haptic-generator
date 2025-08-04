import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import compression from 'vite-plugin-compression'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  const isProduction = mode === 'production'
  const isDevelopment = mode === 'development'

  return {
    plugins: [
      react({
        // Enable Fast Refresh only in development
        fastRefresh: isDevelopment,
        // Optimize JSX for production
        jsxRuntime: 'automatic',
      }),
      // Bundle analyzer for production builds
      isProduction && visualizer({
        filename: 'dist/bundle-analysis.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
      // Gzip compression for production
      isProduction && compression({
        algorithm: 'gzip',
        ext: '.gz',
        deleteOriginFile: false,
      }),
      // Brotli compression for production
      isProduction && compression({
        algorithm: 'brotliCompress',
        ext: '.br',
        deleteOriginFile: false,
      }),
    ].filter(Boolean),
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    
    server: {
      port: 3000,
      host: true, // Listen on all addresses
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
        '/ws': {
          target: env.VITE_WS_BASE_URL || 'ws://localhost:8000',
          ws: true,
          changeOrigin: true,
        },
      },
    },
    
    build: {
      outDir: 'dist',
      // Generate source maps for production debugging
      sourcemap: isProduction ? 'hidden' : true,
      // Minimize bundle size
      minify: isProduction ? 'esbuild' : false,
      // Enable/disable CSS code splitting
      cssCodeSplit: true,
      // Chunk size warnings
      chunkSizeWarningLimit: 1000,
      // Advanced build optimizations
      rollupOptions: {
        output: {
          // Dynamic chunk splitting for better caching and loading
          manualChunks: (id) => {
            // Create separate chunks for different categories
            if (id.includes('node_modules')) {
              // React ecosystem
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react'
              }
              // Query and state management
              if (id.includes('@tanstack/react-query') || id.includes('zustand')) {
                return 'vendor-state'
              }
              // Charts and visualization
              if (id.includes('chart.js') || id.includes('react-chartjs-2') || 
                  id.includes('chartjs-plugin-streaming')) {
                return 'vendor-charts'
              }
              // HTTP and utilities
              if (id.includes('axios')) {
                return 'vendor-http'
              }
              // Other vendor dependencies
              return 'vendor-misc'
            }
            // Component chunks for code splitting
            if (id.includes('/components/')) {
              if (id.includes('/ControlPanel/')) {
                return 'components-controls'
              }
              if (id.includes('/Visualization/')) {
                return 'components-viz'
              }
              if (id.includes('/Common/')) {
                return 'components-common'
              }
            }
            // Service and utility chunks
            if (id.includes('/services/') || id.includes('/hooks/')) {
              return 'services-hooks'
            }
          },
          // Optimize chunk names for caching
          chunkFileNames: isProduction 
            ? 'assets/js/[name]-[hash].js'
            : 'assets/js/[name].js',
          entryFileNames: isProduction 
            ? 'assets/js/[name]-[hash].js' 
            : 'assets/js/[name].js',
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.')
            const extType = info[info.length - 1]
            if (/\.(css)$/.test(assetInfo.name)) {
              return isProduction 
                ? 'assets/css/[name]-[hash].[ext]' 
                : 'assets/css/[name].[ext]'
            }
            if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name)) {
              return isProduction 
                ? 'assets/images/[name]-[hash].[ext]' 
                : 'assets/images/[name].[ext]'
            }
            return isProduction 
              ? `assets/${extType}/[name]-[hash].[ext]` 
              : `assets/${extType}/[name].[ext]`
          },
        },
        // External dependencies (if needed for CDN)
        external: [],
      },
      // Target configuration
      target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari13'],
      // Asset handling
      assetsInlineLimit: 4096, // 4kb
      // CSS options
      cssTarget: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari13'],
    },
    
    // Environment variables
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    
    // Performance optimizations
    esbuild: {
      // Remove console and debugger in production
      drop: isProduction ? ['console', 'debugger'] : [],
      // Enable pure annotations for better tree shaking
      pure: isProduction ? ['console.log', 'console.warn', 'console.error'] : [],
      // Optimize for production
      legalComments: isProduction ? 'none' : 'eof',
      minifyIdentifiers: isProduction,
      minifySyntax: isProduction,
      minifyWhitespace: isProduction,
      treeShaking: true,
    },
    
    // Dependency optimization
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        '@tanstack/react-query',
        'axios',
        'zustand',
        'chart.js',
        'react-chartjs-2',
        'chartjs-plugin-streaming',
      ],
      exclude: [],
    },
    
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'src/test/',
          '**/*.d.ts',
          '**/*.config.*',
          'dist/',
          'tests/e2e/',
          'src/test/mocks/**',
        ],
        thresholds: {
          global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
          },
        },
      },
    },
  }
})