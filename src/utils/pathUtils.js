// Helpers that translate between a physical file path inside
// /public/content (e.g. "guides/Getting Started.md") and the URL route used
// to display it (e.g. "/guides/getting-started" -> encoded segments,
// extension omitted).

export const MARKDOWN_EXTS = ['md', 'markdown']
export const TEXT_EXTS = ['txt', 'text', 'log', 'csv', 'json', 'yaml', 'yml', 'js', 'css', 'html']
export const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico']
export const PDF_EXTS = ['pdf']

export function extOf(name) {
  const idx = name.lastIndexOf('.')
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase()
}

export function withoutExt(filePath) {
  const idx = filePath.lastIndexOf('.')
  return idx === -1 ? filePath : filePath.slice(0, idx)
}

export function dirOf(filePath) {
  const idx = filePath.lastIndexOf('/')
  return idx === -1 ? '' : filePath.slice(0, idx)
}

// Encode a file path (without extension) into a URL route path.
export function pathToRoute(filePathNoExt) {
  return filePathNoExt
    .split('/')
    .map(encodeURIComponent)
    .join('/')
}

// Decode a URL route path (e.g. from useParams) back into a plain,
// comparable path (still without extension).
export function routeToPath(routePath) {
  return routePath
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent)
    .join('/')
}

// Given the manifest (array of {id, path, name, ext}) and a raw route path
// (e.g. "" or "1" or "2"), find the matching file entry by ID.
export function findFileForRoute(manifest, rawRoutePath) {
  const decoded = routeToPath(rawRoutePath || '')
  if (!decoded) {
    return (
      manifest.find((f) => withoutExt(f.path).toLowerCase() === 'readme') ||
      manifest[0] ||
      null
    )
  }

  return (
    manifest.find((f) => String(f.id) === decoded) ||
    null
  )
}

export function fileKind(ext) {
  const e = ext.toLowerCase()
  if (MARKDOWN_EXTS.includes(e)) return 'markdown'
  if (IMAGE_EXTS.includes(e)) return 'image'
  if (PDF_EXTS.includes(e)) return 'pdf'
  return 'text'
}
