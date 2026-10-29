// Provides URL builder and manifest URL for fetching local content files in /public/content.

const BASE = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

export const CONTENT_BASE_URL = `${BASE}content`
export const MANIFEST_URL = `${CONTENT_BASE_URL}/manifest.json`

// Backward compatibility alias in case of external/legacy references
export const CDN_BASE_URL = CONTENT_BASE_URL

export function contentUrl(filePath) {
  if (!filePath) return ''
  const cleanPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '')
  const encoded = encodeURI(cleanPath).replace(/#/g, '%23').replace(/\?/g, '%3F')
  return `${CONTENT_BASE_URL}/${encoded}`
}
