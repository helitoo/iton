
// Turns the flat manifest array into a nested tree:
// { type: 'folder', name, path, children: [...] }
// { type: 'file', name, path, route, ext }
// Folders are always listed before files, both sorted alphabetically
// (Vietnamese-aware).
export function buildTree(manifest) {
  const root = { type: 'folder', name: '', path: '', children: [] }

  for (const file of manifest) {
    const segments = file.path.split('/')
    let node = root
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i]
      const folderPath = segments.slice(0, i + 1).join('/')
      let child = node.children.find((c) => c.type === 'folder' && c.name === seg)
      if (!child) {
        child = { type: 'folder', name: seg, path: folderPath, children: [] }
        node.children.push(child)
      }
      node = child
    }
    node.children.push({
      type: 'file',
      name: segments[segments.length - 1],
      path: file.path,
      id: file.id,
      route: String(file.id),
      ext: file.ext,
    })
  }

  sortTree(root)
  return root
}

function sortTree(node) {
  if (node.type !== 'folder') return
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' })
  })
  for (const child of node.children) sortTree(child)
}
