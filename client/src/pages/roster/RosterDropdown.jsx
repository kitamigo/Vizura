import { useEffect, useRef, useState } from 'react'

export default function RosterDropdown({
  value,
  options,
  onChange,
  placeholder = 'Select',
  className = '',
  icon,
  ariaLabel,
  popoverId,
  menuContent,
  menuClassName = '',
}) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const selected = options.find((option) => option.value === value)
  const id = popoverId || ariaLabel || placeholder

  useEffect(() => {
    const close = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    const closeOnOtherPopover = (event) => {
      if (event.detail !== id) setOpen(false)
    }
    window.addEventListener('roster-popover-open', closeOnOtherPopover)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('roster-popover-open', closeOnOtherPopover)
    }
  }, [id])

  return (
    <div ref={root} className={`roster-dropdown ${className}`}>
      <button
        type="button"
        className="roster-dropdown-trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => {
            const nextOpen = !current
            if (nextOpen) {
              window.dispatchEvent(new CustomEvent('roster-popover-open', { detail: id }))
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
            }
            return nextOpen
          })
        }}
      >
        {icon && <span className="roster-dropdown-icon" aria-hidden="true">{icon}</span>}
        <span>{selected?.label || placeholder}</span>
        <span className="roster-dropdown-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div
          className={`roster-dropdown-menu ${menuClassName}`}
          role={menuContent ? 'presentation' : 'listbox'}
          onClick={menuContent ? () => setOpen(false) : undefined}
        >
          {menuContent || options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`roster-dropdown-option ${option.value === value ? 'is-selected' : ''}`}
              key={option.value}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
