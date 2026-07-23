// Provides URL builder and manifest URL for fetching content files hosted on jsDelivr CDN.

export const CDN_BASE_URL = 'https://cdn.jsdelivr.net/gh/helitoo/IT-Obsidian-Notebook@main'
export const MANIFEST_URL = `${CDN_BASE_URL}/manifest.json`

export function contentUrl(filePath) {
  if (!filePath) return ''
  const cleanPath = filePath.replace(/^\/+/, '')
  return `${CDN_BASE_URL}/${cleanPath.split('/').map(encodeURIComponent).join('/')}`
}

