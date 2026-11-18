import Sidebar from './Sidebar'
import { Outlet } from 'react-router-dom'

function MainLayout({ collapsed, onToggle }) {
  return (
    <div className="flex min-h-screen mt-14 bg-sky-50 dark:bg-slate-950 transition-colors duration-200">

      {/* Sidebar */}
      <Sidebar collapsed={collapsed} onToggle={onToggle} />

      {/* Main content */}
      <div className={`flex-1 px-6 pb-6 pt-6 transition-[margin] duration-300 ease-in-out ${collapsed ? 'ml-16' : 'ml-64'}`}>
        <Outlet />
      </div>

    </div>
  )
}

export default MainLayout
