export function slugify(text, usedSlugs = null) {
  let base = text
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics for stable anchors
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!base) base = 'section'

  if (usedSlugs) {
    let slug = base
    let i = 2
    while (usedSlugs.has(slug)) {
      slug = `${base}-${i++}`
    }
    usedSlugs.add(slug)
    return slug
  }

  return base
}
