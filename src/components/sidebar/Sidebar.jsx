import React, { useCallback, useRef } from 'react'
import { VscClose } from "react-icons/vsc";
import SidebarTree from './SidebarTree'
import { useContentData } from '../../utils/context/ContentContext'

export default function Sidebar({ open, onClose, width, onWidthChange }) {
  const { tree, loading } = useContentData()
  const draggingRef = useRef(false)

  const startResize = useCallback(
    (e) => {
      e.preventDefault()
      draggingRef.current = true
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const onMove = (moveEvent) => {
        if (!draggingRef.current) return
        const percent = (moveEvent.clientX / window.innerWidth) * 100
        onWidthChange(Math.min(50, Math.max(14, percent)))
      }
      const onUp = () => {
        draggingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [onWidthChange]
  )

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-14 bottom-0 left-0 z-40 bg-white border-r border-gray-200 overflow-y-auto md:hidden
          transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: `min(85vw, 320px)` }}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 md:hidden">
          <span className="text-sm font-semibold text-gray-500">Danh mục</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Đóng menu">
            <VscClose size={18} />
          </button>
        </div>
        {loading ? (
          <p className="px-3 py-3 text-sm text-gray-400">Đang tải...</p>
        ) : (
          <SidebarTree tree={tree} onNavigate={onClose} />
        )}
      </aside>

      {/* Desktop sidebar (resizable) */}
      <aside
        className="hidden md:block fixed top-14 bottom-0 left-0 z-20 bg-white border-r border-gray-200 overflow-y-auto"
        style={{ width: `${width}%` }}
      >
        {loading ? (
          <p className="px-3 py-3 text-sm text-gray-400">Đang tải...</p>
        ) : (
          <SidebarTree tree={tree} />
        )}
        <div
          onMouseDown={startResize}
          className="hidden md:block fixed top-14 bottom-0 w-1 cursor-col-resize z-30"
          style={{ left: `calc(${width}% - 3px)` }}
          role="separator"
          aria-orientation="vertical"
          aria-label="Thay đổi kích thước thanh bên"
        />
      </aside>
    </>
  )
}
