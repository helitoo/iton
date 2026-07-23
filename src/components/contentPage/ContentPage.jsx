import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useOutletContext } from 'react-router-dom'
import { useContentData } from '../../utils/context/ContentContext'
import { findFileForRoute, fileKind } from '../../utils/pathUtils'
import { contentUrl } from '../../utils/context/manifest'
import MarkdownView from './MarkdownView'

export default function ContentPage() {
  const { manifest, loading: manifestLoading } = useContentData()
  const location = useLocation()
  const { setActiveFileName } = useOutletContext()

  const routePath = location.pathname.replace(/^\//, '')
  const file = useMemo(
    () => (manifestLoading ? null : findFileForRoute(manifest, routePath)),
    [manifest, manifestLoading, routePath]
  )

  const [text, setText] = useState('')
  const [status, setStatus] = useState('loading') // loading | ready | error

  useEffect(() => {
    setActiveFileName(file ? file.name : '')
  }, [file, setActiveFileName])

  useEffect(() => {
    if (manifestLoading) return
    if (!file) {
      setStatus('error')
      return
    }
    const kind = fileKind(file.ext)
    if (kind === 'markdown' || kind === 'text') {
      setStatus('loading')
      fetch(contentUrl(file.path))
        .then((res) => {
          if (!res.ok) throw new Error('not ok')
          return res.text()
        })
        .then((t) => {
          setText(t)
          setStatus('ready')
        })
        .catch(() => setStatus('error'))
    } else {
      setStatus('ready')
    }
  }, [file, manifestLoading])

  if (manifestLoading || status === 'loading') {
    return (
      <div className="px-6 py-10 text-gray-400 text-sm">Đang tải nội dung...</div>
    )
  }

  if (!file || status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-xl font-bold text-gray-800 mb-1">Không tìm thấy nội dung</h1>
        <p className="text-gray-500 text-sm">
          Không tìm thấy.
        </p>
      </div>
    )
  }

  const kind = fileKind(file.ext)

  if (kind === 'image') {
    return (
      <div className="px-6 py-8 flex justify-center">
        <img src={contentUrl(file.path)} alt={file.name} className="max-w-full rounded-md shadow-sm" />
      </div>
    )
  }

  if (kind === 'pdf') {
    return (
      <div className="w-full" style={{ height: 'calc(100vh - 3.5rem)' }}>
        <iframe title={file.name} src={contentUrl(file.path)} className="w-full h-full border-0" />
      </div>
    )
  }

  if (kind === 'markdown') {
    return <MarkdownView file={file} raw={text} manifest={manifest} />
  }

  // Plain text / other raw text formats
  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <pre className="whitespace-pre-wrap wrap-break-word bg-gray-50 border border-gray-200 rounded-md p-4 text-sm text-gray-800">
        {text}
      </pre>
    </div>
  )
}

