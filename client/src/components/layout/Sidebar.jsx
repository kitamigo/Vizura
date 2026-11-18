import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import logoDark from '../../assets/logo_dark.svg'
import logoLight from '../../assets/logo_light.svg'

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
      { label: 'Employees', to: '/app/employees', icon: 'groups' },
    ],
  },
  {
    title: 'System',
    items: [{ label: 'Settings', to: '/app/settings', icon: 'settings' }],
  },
]

function Sidebar({ collapsed, onToggle }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const userName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.name || 'User'
  const userPosition = user?.position || user?.role || 'Member'
  const userInitials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((namePart) => namePart[0].toUpperCase())
    .join('')

  const fade = `transition-opacity ${collapsed ? 'opacity-0 duration-100' : 'delay-150 duration-200'}`

  const navLinkClass = ({ isActive }) =>
    `group relative flex h-10 items-center gap-3 overflow-hidden pr-4 transition-[padding] duration-300 ease-in-out ${
      collapsed ? 'pl-[19.5px]' : 'pl-12'
    } ${
      isActive
        ? 'text-sky-700 dark:text-sky-300'
        : 'text-gray-700 dark:text-gray-300'
    }`

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 z-40 flex flex-col
        border-r border-slate-300 bg-sky-100 dark:border-slate-700 dark:bg-slate-900
        overflow-hidden transition-[width] duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-64'}`}
    >
      {/* logo*/}
      <div className="relative h-14 shrink-0">
        <div className={`absolute inset-0 flex items-center justify-center ${fade}`}>
          <img src={logoDark} alt="Vizura" className="h-[38px] w-40 dark:hidden" />
          <img src={logoLight} alt="Vizura" className="hidden h-[38px] w-40 dark:block" />
        </div>
        <div
          aria-hidden={!collapsed}
          className={`absolute inset-0 flex items-center justify-center text-3xl font-extrabold text-sky-600 transition-opacity dark:text-sky-300 ${
            collapsed ? 'delay-150 duration-200' : 'opacity-0 duration-100'
          }`}
        >
          V
        </div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute left-1/2 top-[68px] z-10 flex h-8 w-8 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-slate-300/70 bg-sky-100 p-0 text-slate-700 shadow-sm transition-[background-color,color,border-color] duration-300 ease-in-out hover:border-sky-300 hover:bg-sky-200 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:bg-slate-800 dark:hover:text-sky-300"
      >
        <span
          aria-hidden="true"
          className="material-symbols-outlined leading-none"
          style={{ fontSize: '18px' }}
        >
          {collapsed ? 'left_panel_open' : 'left_panel_close'}
        </span>
      </button>
      {/* nav links */}
      <nav className="flex-1 pt-[72px]">
        {navGroups.map(({ title, items }) => (
          <section key={title} className="mb-10">
            <h2
              aria-hidden={collapsed}
              className={`mb-3 whitespace-nowrap pl-6 pr-2 text-sm font-bold tracking-wider text-slate-600 dark:text-slate-300 ${fade}`}
            >
              {title}
            </h2>
            <div className="space-y-3">
              {items.map(({ label, to, icon }) => (
                <NavLink key={to} to={to} className={navLinkClass} title={collapsed ? label : undefined}>
                  {({ isActive }) => (
                    <>
                      {/* left line next to icons */}
                      <span
                        aria-hidden="true"
                        className={`absolute inset-y-0 left-8 border-l transition duration-150 ${
                          collapsed ? 'opacity-0' : ''
                        } ${
                          isActive
                            ? 'border-l-[3px] border-sky-600 dark:border-sky-400'
                            : 'border-sky-400/70 group-hover:border-sky-600 dark:border-sky-600/70 dark:group-hover:border-sky-400'
                        }`}
                      />
                      {/* button tint */}
                      <span
                        aria-hidden="true"
                        className={`absolute inset-y-0 rounded-r-sm transition-[left,right,background-color] duration-300 ease-in-out ${
                          collapsed ? 'left-0 right-0' : 'left-8 right-8'
                        } ${
                          isActive
                            ? 'bg-sky-300/50 dark:bg-sky-800/30'
                            : 'bg-transparent group-hover:bg-sky-200/70 dark:group-hover:bg-slate-800'
                        }`}
                      />
                      <span
                        aria-hidden="true"
                        className={`material-symbols-outlined relative z-10 w-6 shrink-0 text-center text-lg leading-none ${isActive ? 'text-sky-600' : 'text-blue-700 dark:text-blue-300'}`}
                      >
                        {icon}
                      </span>
                      <span className={`relative z-10 shrink-0 whitespace-nowrap text-base tracking-wide ${isActive ? 'font-bold' : 'font-medium'} ${fade}`}>
                        {label}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </section>
        ))}
      </nav>
      {/* user info */}
      <div className="border-t border-sky-300 px-5 pb-6 pt-4 dark:border-slate-700">
        <div className="relative h-10">
          <div className={`absolute top-0 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-sm font-semibold text-white shadow-sm ring-2 ring-white/70 transition-[left] duration-300 ease-in-out dark:ring-slate-700 ${
            collapsed ? '-left-[8.5px]' : 'left-0'
          }`}>
            {userInitials}
          </div>
          <div className={`relative ml-[54px] flex h-10 w-40 flex-col justify-center whitespace-nowrap ${fade} ${collapsed ? 'pointer-events-none' : ''}`}>
            <p className="truncate pr-10 text-sm font-semibold leading-tight text-slate-800 dark:text-slate-100">{userName}</p>
            <p className="truncate pr-10 text-xs leading-tight text-slate-600 dark:text-slate-400">
              {userPosition.charAt(0).toUpperCase() + userPosition.slice(1)}
            </p>
            {user ? (
              <button
                type="button"
                onClick={() => {
                  logout()
                  navigate('/login', { replace: true })
                }}
                aria-label="Log out"
                title="Log out"
                tabIndex={collapsed ? -1 : 0}
                className="absolute right-0 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-rose-200 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-500/20 dark:hover:text-rose-400"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-xl leading-none">
                  logout
                </span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar