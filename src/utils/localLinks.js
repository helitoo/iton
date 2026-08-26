import { withoutExt, dirOf, fileKind } from './pathUtils.js'
import { contentUrl } from './context/manifest.js'
import { slugify } from './slugify.js'

function safeDecode(str) {
  if (!str) return ''
  try {
    return decodeURIComponent(str)
  } catch {
    return str
  }
}

function normalizeText(str) {
  if (!str) return ''
  return safeDecode(str).normalize('NFC').trim().toLowerCase()
}

// 1 - Nhận diện cấu trúc path và alias name trong link.
// Ví dụ [[a/b/c|d]] --> path = ['a', 'b', 'c'], alias = 'd', nếu alias không tồn tại thì dùng segment cuối cùng của path làm alias.
export function parseWikiLink(content) {
  if (!content) return { target: '', pathSegments: [], alias: '', anchor: '' }
  const pipeIndex = content.indexOf('|')
  let targetStr = pipeIndex === -1 ? content : content.slice(0, pipeIndex)
  const aliasStr = pipeIndex === -1 ? null : content.slice(pipeIndex + 1)

  targetStr = safeDecode(targetStr || '').normalize('NFC').trim()

  const hashIndex = targetStr.indexOf('#')
  let pathStr = hashIndex === -1 ? targetStr : targetStr.slice(0, hashIndex)
  const anchor = hashIndex === -1 ? '' : targetStr.slice(hashIndex + 1).trim()
  pathStr = pathStr.trim().replace(/^[\\/]+|[\\/]+$/g, '')

  const pathSegments = pathStr
    ? pathStr
        .split(/[\\/]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : []

  let alias = ''
  if (aliasStr !== null && aliasStr.trim().length > 0) {
    alias = aliasStr.trim()
  } else {
    // Nếu alias không tồn tại thì dùng segment cuối cùng của path làm alias
    if (pathSegments.length > 0) {
      alias = pathSegments[pathSegments.length - 1]
    } else if (anchor) {
      alias = anchor
    } else {
      alias = targetStr
    }
  }

  return {
    target: targetStr,
    pathSegments,
    alias,
    anchor,
  }
}

// 2 - Tìm địa chỉ thật sự trong manifest theo quy tắc: tìm ngược từ segment cuối cùng lên segment trên cùng.
export function resolveLocalTarget(manifest, currentFilePath, target) {
  if (!manifest || !Array.isArray(manifest) || manifest.length === 0 || !target) {
    return null
  }

  const cleanTarget = safeDecode(target).normalize('NFC').trim()
  const pathOnly = cleanTarget.split('#')[0].trim().replace(/^[\\/]+|[\\/]+$/g, '')
  if (!pathOnly) return null

  const targetSegs = pathOnly
    .split(/[\\/]+/)
    .map((s) => safeDecode(s).normalize('NFC').trim())
    .filter(Boolean)

  if (targetSegs.length === 0) return null

  const targetLen = targetSegs.length
  const lastTargetSeg = targetSegs[targetLen - 1]
  const hasExt = /\.[a-zA-Z0-9]+$/.test(lastTargetSeg)
  const lastTargetSegNoExt = normalizeText(withoutExt(lastTargetSeg))
  const lastTargetSegFull = normalizeText(lastTargetSeg)

  const candidates = []

  for (const file of manifest) {
    if (!file || !file.path) continue

    const cleanFilePath = safeDecode(file.path).normalize('NFC').replace(/^[\\/]+|[\\/]+$/g, '')
    const fileSegs = cleanFilePath
      .split(/[\\/]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const fileLen = fileSegs.length
    if (fileLen === 0) continue

    const lastFileSeg = fileSegs[fileLen - 1]
    const lastFileSegNoExt = normalizeText(withoutExt(lastFileSeg))
    const lastFileSegFull = normalizeText(lastFileSeg)

    let matchLast = false
    if (hasExt) {
      matchLast = lastFileSegFull === lastTargetSegFull
    } else {
      matchLast =
        lastFileSegNoExt === lastTargetSegNoExt ||
        lastFileSegFull === lastTargetSegFull
    }

    if (!matchLast) continue

    // Tìm ngược từ segment cuối cùng lên segment trên cùng
    let matchedSegments = 1
    for (let i = 1; i < targetLen; i++) {
      const targetIdx = targetLen - 1 - i
      const fileIdx = fileLen - 1 - i

      if (fileIdx < 0) {
        break
      }

      const tSeg = normalizeText(targetSegs[targetIdx])
      const fSeg = normalizeText(fileSegs[fileIdx])
      const tSegNoExt = normalizeText(withoutExt(targetSegs[targetIdx]))
      const fSegNoExt = normalizeText(withoutExt(fileSegs[fileIdx]))

      if (tSeg === fSeg || tSegNoExt === fSegNoExt) {
        matchedSegments++
      } else {
        break
      }
    }

    candidates.push({
      file,
      matchedSegments,
      fileSegsCount: fileLen,
    })
  }

  if (candidates.length === 0) return null

  const currentDir = dirOf(safeDecode(currentFilePath || '').normalize('NFC'))
  const currentSegs = currentDir
    ? currentDir
        .split(/[\\/]+/)
        .map((s) => normalizeText(s))
        .filter(Boolean)
    : []

  function distance(file) {
    const fileDir = dirOf(safeDecode(file.path || '').normalize('NFC'))
    const fileSegs = fileDir
      ? fileDir
          .split(/[\\/]+/)
          .map((s) => normalizeText(s))
          .filter(Boolean)
      : []
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
    // 1. Số lượng segment khớp ngược từ cuối lên nhiều nhất
    if (b.matchedSegments !== a.matchedSegments) {
      return b.matchedSegments - a.matchedSegments
    }
    // 2. Khoảng cách thư mục tới currentFilePath (ưu tiên file gần thư mục hiện tại nhất)
    const distA = distance(a.file)
    const distB = distance(b.file)
    if (distA !== distB) {
      return distA - distB
    }
    // 3. Độ chênh lệch chiều sâu thư mục so với target
    const diffA = Math.abs(a.fileSegsCount - targetLen)
    const diffB = Math.abs(b.fileSegsCount - targetLen)
    if (diffA !== diffB) {
      return diffA - diffB
    }
    // 4. Thứ tự từ điển
    return a.file.path.localeCompare(b.file.path, 'vi')
  })

  return candidates[0].file
}

// Returns { type: 'route'|'url'|'anchor'|'missing', href } for use in <a>/<img> rendering.
export function resolveWikiHref(manifest, currentFilePath, target) {
  if (!target) return { type: 'missing', href: '#' }

  const cleanTarget = safeDecode(target).normalize('NFC').trim()
  const hashIdx = cleanTarget.indexOf('#')
  const pathPart = hashIdx === -1 ? cleanTarget : cleanTarget.slice(0, hashIdx).trim()
  const anchorPart = hashIdx === -1 ? '' : cleanTarget.slice(hashIdx + 1).trim()
  const anchorHash = anchorPart ? `#${slugify(anchorPart)}` : ''

  if (!pathPart) {
    return { type: 'anchor', href: anchorHash || '#' }
  }

  const file = resolveLocalTarget(manifest, currentFilePath, pathPart)
  if (!file) return { type: 'missing', href: '#' }

  const kind = fileKind(file.ext)
  if (kind === 'markdown') {
    return { type: 'route', href: `/${file.id}${anchorHash}` }
  }
  return { type: 'url', href: `${contentUrl(file.path)}${anchorHash}` }
}
