import { withoutExt, dirOf, pathToRoute, fileKind } from './pathUtils'
import { contentUrl } from './context/manifest'

// Resolve a wikilink target (e.g. "Setup", "images/logo.png", "Setup.md")
// to the closest matching file relative to `currentFilePath`'s directory.
//
// Strategy: among all files whose name matches the target (with or without
// extension, case-insensitive), pick the one whose directory is "closest"
// to the current file's directory - measured by how many path segments
// differ from the current directory. Ties are broken alphabetically.
export function resolveLocalTarget(manifest, currentFilePath, target) {
  const cleanTarget = target.trim()
  const targetHasExt = /\.[a-zA-Z0-9]+$/.test(cleanTarget)
  const targetNoExt = withoutExt(cleanTarget).toLowerCase()
  const targetName = cleanTarget.toLowerCase()
  const currentDir = dirOf(currentFilePath)

  const candidates = manifest.filter((f) => {
    const nameNoExt = withoutExt(f.name).toLowerCase()
    const fullName = f.name.toLowerCase()
    if (targetHasExt) {
      // Match against full name, or against the path relative-ish (allow
      // target to include sub-folders, e.g. "images/logo.png").
      return fullName === targetName || f.path.toLowerCase().endsWith('/' + targetName) || f.path.toLowerCase() === targetName
    }
    return nameNoExt === targetNoExt || f.path.toLowerCase().endsWith('/' + targetNoExt) || withoutExt(f.path).toLowerCase() === targetNoExt
  })

  if (candidates.length === 0) return null

  const currentSegs = currentDir ? currentDir.split('/') : []

  function distance(file) {
    const fileDir = dirOf(file.path)
    const fileSegs = fileDir ? fileDir.split('/') : []
    let common = 0
    while (
      common < currentSegs.length &&
      common < fileSegs.length &&
      currentSegs[common] === fileSegs[common]
    ) {
      common++
    }
    return (currentSegs.length - common) + (fileSegs.length - common)
  }

  candidates.sort((a, b) => {
    const d = distance(a) - distance(b)
    if (d !== 0) return d
    return a.path.localeCompare(b.path, 'vi')
  })

  return candidates[0]
}

// Returns { type: 'route'|'url', href } for use in <a>/<img> rendering.
export function resolveWikiHref(manifest, currentFilePath, target) {
  const file = resolveLocalTarget(manifest, currentFilePath, target)
  if (!file) return { type: 'missing', href: '#' }
  const kind = fileKind(file.ext)
  if (kind === 'markdown') {
    return { type: 'route', href: '/' + pathToRoute(withoutExt(file.path)) }
  }
  return { type: 'url', href: contentUrl(file.path) }
}
