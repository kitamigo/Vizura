import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'

const navGroups = [
  {
    title: 'General',
    items: [{ label: 'Dashboard', to: '/app/dashboard', icon: 'dashboard' }],
  },
  {
    title: 'Modules',
    items: [
      { label: 'Analytics', to: '/app/analytics', icon: 'finance_mode' },
      { label: 'Payroll', to: '/app/payroll', icon: 'finance_chip' },
      { label: 'Roster', to: '/app/roster', icon: 'calendar_month' },
      { label: 'Staff Management', to: '/app/employees', icon: 'groups' },
    ],
  },
  {
    title: 'Fixins',
    items: [{ label: 'Settings', to: '/app/settings', icon: 'settings' }],
  },
]

function Sidebar({ collapsed, onToggle }) {
  const { user } = useAuth()
  const userName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.name || 'User'
  const userPosition = user?.position || user?.role || 'Member'
  const userInitials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((namePart) => namePart[0].toUpperCase())
    .join('')

  const navLinkClass = ({ isActive }) =>
    `relative flex items-center rounded-lg py-2 transition-colors ${
      collapsed ? 'justify-center px-2' : 'gap-[16px] px-4'
    } ${
      isActive
        ? 'bg-sky-500 text-white'
        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
    }`
  
  return (
    <aside
      className={`fixed left-0 top-16 bottom-0 z-40 flex flex-col rounded-r-3xl
        border-r border-slate-300 bg-sky-200 dark:border-slate-700 dark:bg-slate-900
        overflow-hidden transition-[width] duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-64'}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="m-3 flex h-8 w-8 items-center justify-center self-end cursor-pointer p-0 text-slate-700 transition-colors hover:text- dark:text-slate-200 dark:hover:text-white"
      >
        <span aria-hidden="true" className="material-symbols-outlined relative -left-1 text-base leading-none">
          {collapsed ? 'menu' : 'chevron_left'}
        </span>
      </button>
      {/* nav links */}
      <nav className={`flex-1 ${collapsed ? 'px-2' : 'px-4'}`}>
        {navGroups.map(({ title, items }) => (
          <section key={title} className="mb-8">
            <h2
              aria-hidden={collapsed}
              className={`mb-3 whitespace-nowrap px-2 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 ${
                collapsed ? 'invisible opacity-0' : 'visible opacity-100'
              }`}
            >
              {title}
            </h2>
            <div className="space-y-1">
              {items.map(({ label, to, icon }) => (
                <NavLink key={to} to={to} className={navLinkClass} title={collapsed ? label : undefined}>
                  <span
                    aria-hidden="true"
                    className={`material-symbols-outlined text-center text-lg leading-none ${
                      collapsed ? 'absolute left-0 w-full' : 'w-5'
                    }`}
                  >
                    {icon}
                  </span>
                  <span className={`overflow-hidden whitespace-nowrap font-[Roboto_Condensed] text-base tracking-wide ${
                    collapsed
                      ? 'max-w-0 -translate-x-2 opacity-0'
                      : 'max-w-[180px] translate-x-0 opacity-100'
                  }`}>
                    {label}
                  </span>
                </NavLink>
              ))}
            </div>
          </section>
        ))}
      </nav>
      {/* user info */}
      <div className="border-t border-sky-300 px-5 pb-6 pt-4 dark:border-slate-800">
        <div className="relative h-10">
          <div className={`absolute top-0 flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-sm font-semibold text-white transition-[left] duration-300 ease-in-out ${
            collapsed ? 'left-1/2 -translate-x-1/2' : 'left-0 translate-x-0'
          }`}>
            {userInitials}
          </div>
          <div className={`overflow-hidden whitespace-nowrap transition-all duration-500 ease-in-out ${
            collapsed ? 'max-w-0 translate-x-[-8px] opacity-0' : 'ml-[54px] max-w-[160px] translate-x-0 opacity-100'
          }`}>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{userName}</p>
            <p className="text-xs text-gray-800 dark:text-gray-400">
              {userPosition.charAt(0).toUpperCase() + userPosition.slice(1)}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar