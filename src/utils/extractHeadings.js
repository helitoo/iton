import { slugify } from './slugify'

export function cleanHeadingText(text) {
  return text
    // Remove links: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bold, italic, code formatting
    .replace(/[\*_~`]/g, '')
    .trim()
}

// Parses raw markdown and returns a flat list of headings:
// [{ level, text, id }]
// Ignores headings inside fenced code blocks.
export function extractHeadings(markdown) {
  const lines = markdown.split('\n')
  const headings = []
  const usedSlugs = new Set()
  let inFence = false
  let fenceMarker = ''

  for (const line of lines) {
    const fenceMatch = /^\s*(```|~~~)/.exec(line)
    if (fenceMatch) {
      if (!inFence) {
        inFence = true
        fenceMarker = fenceMatch[1]
      } else if (line.trim().startsWith(fenceMarker)) {
        inFence = false
      }
      continue
    }
    if (inFence) continue

    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (match) {
      const level = match[1].length
      const rawText = match[2].trim()
      const text = cleanHeadingText(rawText)
      const id = slugify(text, usedSlugs)
      headings.push({ level, text, id })
    }
  }

  return headings
}

// Builds a nested tree out of the flat heading list, supporting
// non-consecutive levels (e.g. H1 followed directly by H3).
export function headingsToTree(headings) {
  const root = { level: 0, children: [] }
  const stack = [root]

  for (const heading of headings) {
    const node = { ...heading, children: [] }
    while (stack.length > 1 && stack[stack.length - 1].level >= node.level) {
      stack.pop()
    }
    stack[stack.length - 1].children.push(node)
    stack.push(node)
  }

  return root.children
}
