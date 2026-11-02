import Sidebar from './Sidebar'
import { Outlet } from 'react-router-dom'
import { useState } from 'react'

function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="flex min-h-screen mt-12 bg-sky-50 dark:bg-slate-950 transition-colors duration-200">
      
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
      />

      {/* Main content */}
      <div className={`flex-1 px-6 pb-6 pt-2 transition-[margin] duration-200 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <Outlet />
      </div>

    </div>
  )
}

export default MainLayout