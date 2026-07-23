import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './navbar/Navbar'
import Sidebar from './sidebar/Sidebar'

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(20) // percent, 1/5 of screen by default
  const [activeFileName, setActiveFileName] = useState('')

  return (
    <div className="min-h-screen bg-white">
      <Navbar activeFileName={activeFileName} onToggleSidebar={() => setSidebarOpen((o) => !o)} />
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
      />
      <main
        className="pt-14 min-h-screen"
        style={{ marginLeft: 0 }}
      >
        <div className="md:ml-[var(--sidebar-w)]" style={{ '--sidebar-w': `${sidebarWidth}%` }}>
          <Outlet context={{ setActiveFileName }} />
        </div>
      </main>
    </div>
  )
}
