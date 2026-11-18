import { useEffect, useState } from 'react'
import toggleDarkIcon from '../../assets/toggle_dark_mode.svg'
import toggleLightIcon from '../../assets/toggle_light_mode.svg'

function Header({ sidebarCollapsed, title }) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    const theme = window.localStorage.getItem('theme')
    if (theme === 'dark') {
      return true
    }

    if (theme === 'light') {
      return false
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const docRoot = document.documentElement
    docRoot.classList.toggle('dark', isDarkMode)
    window.localStorage.setItem('theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  const toggleIcon = isDarkMode ? toggleLightIcon : toggleDarkIcon

  return (
    <header
      className={`
        fixed top-0 right-0 h-14 ${sidebarCollapsed ? 'left-16' : 'left-64'}
        bg-sky-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100
        flex items-center justify-between px-12 sm:px-12 lg:px-14 z-50
        transition-[left,background-color,color] duration-300 ease-in-out
      `}
    >

      <h1 className="truncate text-xl font-bold tracking-wide text-sky-600 dark:text-sky-300">
        {title}
      </h1>

      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setIsDarkMode((cur) => !cur)}
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-pressed={isDarkMode}
          className="rounded-full p-1 transition hover:bg-black/5 dark:hover:bg-white/10"
        >
          <img
            src={toggleIcon}
            alt=""
            aria-hidden="true"
            className="h-9 w-9 cursor-pointer"
          />
        </button>
      </div>

    </header>
  )
}

export default Header