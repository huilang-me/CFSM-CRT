import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const origins = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim().replace(/\/+$/, ''))
  .filter(Boolean)

// CSP 里 https://host 不覆盖 wss://host，需要各自列出
const withSocket = (list) => {
  const out = []
  for (const item of list) {
    out.push(item)
    if (/^https:\/\//i.test(item)) out.push('wss://' + item.slice(8))
    else if (/^http:\/\//i.test(item)) out.push('ws://' + item.slice(7))
  }
  return [...new Set(out)]
}

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const escapeCss = (value) => String(value || '').replace(/'/g, '%27')

// 真实环境变量（GitHub Actions Secrets、命令行）优先，其次 .env / .env.local / .env.[mode]
// IGNORE_ENV=1 时完全忽略环境变量与 .env 文件，用于构建不含站点配置的通用 dist
function readEnv(mode) {
  const ignore = process.env.IGNORE_ENV === '1'
  const file = ignore ? {} : loadEnv(mode, __dirname, '')
  const pick = (key) => {
    if (ignore) return ''
    const value = process.env[key]
    if (value !== undefined && value !== '') return value
    return file[key] ?? ''
  }
  return {
    apiBase: origins(pick('API_BASE')),
    cspApi: origins(pick('CSP_API')),
    cspStatic: origins(pick('CSP_STATIC')),
    title: pick('TITLE'),
    background: pick('BACKGROUND_IMAGE'),
    proxyTarget: pick('VITE_DEV_PROXY_TARGET') || 'https://localhost:8787'
  }
}

function createProxy(target) {
  const proxy = { target, changeOrigin: true, secure: false, ws: true }
  return {
    '/api': proxy,
    '/admin/api': proxy,
    '/theme': proxy,
    '/update': proxy,
    '/updateDatabase': proxy,
    '/clearHistory': proxy,
    '/__do': proxy
  }
}

function runtimeConfig(env) {
  return {
    name: 'cfsm-runtime-config',
    transformIndexHtml(html) {
      const meta = [...env.apiBase, ...env.cspApi]
      if (meta.length) {
        html = html.replace(/<meta name="apiBase" content=""\s*\/?>/i, '<meta name="apiBase" content="' + escapeHtml(meta.join(',')) + '">')
      }
      if (env.title) {
        html = html.replace(/<title>.*?<\/title>/i, '<title>' + escapeHtml(env.title) + '</title>')
      }
      if (env.background) {
        html = html.replace('</head>', '<style>body{background-image:url(\'' + escapeCss(env.background) + '\');background-size:cover;background-attachment:fixed;background-position:center;}</style>\n</head>')
      }
      if (env.apiBase.length || env.cspApi.length || env.cspStatic.length) {
        const connect = ["'self'", ...withSocket([...env.apiBase, ...env.cspApi])].join(' ')
        const extra = env.cspStatic.length ? ' ' + env.cspStatic.join(' ') : ''
        const policy = [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com" + extra,
          "style-src 'self' 'unsafe-inline' https://challenges.cloudflare.com" + extra,
          "img-src 'self' data: https:" + extra,
          "font-src 'self' data:" + extra,
          "connect-src " + connect,
          "frame-src https://challenges.cloudflare.com",
          "object-src 'none'",
          "base-uri 'self'"
        ].join('; ')
        html = html.replace('</head>', '<meta http-equiv="Content-Security-Policy" content="' + escapeHtml(policy) + '">\n</head>')
      }
      return html
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = readEnv(mode)
  const proxy = createProxy(env.proxyTarget)

  return {
    plugins: [vue(), basicSsl(), runtimeConfig(env)],
    // GitHub Pages 等子路径部署时用 VITE_BASE 覆盖，默认站点根目录
    base: process.env.VITE_BASE || '/',
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') }
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      }
    },
    // basicSsl() 会给 dev / preview 挂上自签名证书
    server: {
      host: 'localhost',
      port: 5173,
      strictPort: true,
      proxy
    },
    preview: {
      host: 'localhost',
      port: 4173,
      strictPort: true,
      proxy
    }
  }
})
