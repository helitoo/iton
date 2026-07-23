import { withoutExt, fileKind } from './pathUtils'
import { contentUrl } from './context/manifest'

const MAX_RESULTS = 5

// Very small fuzzy scorer: rewards subsequence matches and bonuses for
// contiguous runs / early position. Returns -1 if the query isn't even a
// subsequence of the text.
function fuzzyScore(text, query) {
  text = text.toLowerCase()
  query = query.toLowerCase()
  if (!query) return -1
  if (text.includes(query)) {
    // Strong bonus for a direct substring match; shorter distance to start
    // scores higher.
    return 1000 - text.indexOf(query)
  }
  let score = 0
  let ti = 0
  let run = 0
  for (let qi = 0; qi < query.length; qi++) {
    const ch = query[qi]
    const found = text.indexOf(ch, ti)
    if (found === -1) return -1
    run = found === ti ? run + 1 : 1
    score += 1 + run
    ti = found + 1
  }
  return score
}

function nameScore(fileName, query) {
  const base = withoutExt(fileName).toLowerCase()
  const q = query.toLowerCase()
  if (base === q) return 10000
  if (base.startsWith(q)) return 5000 - base.length
  return fuzzyScore(fileName, query)
}

export async function searchFiles(manifest, query) {
  const q = query.trim()
  if (!q) return []

  // 1. Filename matches, ranked.
  const nameMatches = manifest
    .map((f) => ({ file: f, score: nameScore(f.name, q) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score)

  const results = nameMatches.slice(0, MAX_RESULTS).map((r) => ({
    ...r.file,
    matchType: 'name',
  }))

  if (results.length >= MAX_RESULTS) return results

  // 2. Fuzzy content matches for markdown/plain-text files not already
  // included, filling up to MAX_RESULTS.
  const already = new Set(results.map((r) => r.path))
  const textFiles = manifest.filter(
    (f) => !already.has(f.path) && ['markdown', 'text'].includes(fileKind(f.ext))
  )

  const contentScored = []
  await Promise.all(
    textFiles.map(async (f) => {
      try {
        const res = await fetch(contentUrl(f.path))
        if (!res.ok) return
        const text = await res.text()
        const score = fuzzyScore(text.slice(0, 20000), q)
        if (score >= 0) contentScored.push({ ...f, score, matchType: 'content' })
      } catch {
        // ignore unreadable files
      }
    })
  )

  contentScored.sort((a, b) => b.score - a.score)

  for (const item of contentScored) {
    if (results.length >= MAX_RESULTS) break
    results.push(item)
  }

  return results.slice(0, MAX_RESULTS)
}
