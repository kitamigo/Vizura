import { useState } from 'react'
import { Link } from 'react-router-dom'

function RegisterForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm_password: ''
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)

  const handleChange = (e) => {
    const value = ['first_name', 'last_name'].includes(e.target.name)
      ? e.target.value.replace(/[^a-zA-Z]/g, '').replace(/^([a-z])/, (_, firstLetter) => firstLetter.toUpperCase())
      : e.target.value

    setFormData({
      ...formData,
      [e.target.name]: value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (formData.password.length < 8 || !/[A-Z]/.test(formData.password) || !/\d/.test(formData.password)) {
      setError('Password must be at least 8 characters and include 1 uppercase letter and 1 number.')
      return
    }

    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const registrationData = { ...formData }
      delete registrationData.confirm_password
      await onSubmit(registrationData)
    } catch (err) {
      setError(err?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm transition-colors duration-200">
      <h2 className="text-center text-2xl font-bold mb-2 text-blue-700 dark:text-sky-300">Create Account</h2>


      {/* Divider */}
      <div className="flex items-center gap-4 my-6">

        <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />

        <span className="text-sm text-gray-700 dark:text-gray-400 whitespace-nowrap">
          Create an account to get started
        </span>

        <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />

      </div>

      {error && (
        <p className="text-red-500 mb-3 text-sm">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            name="first_name"
            placeholder="First Name"
            className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500"
            value={formData.first_name}
            onChange={handleChange}
            minLength="3"
            pattern="[A-Za-z]{3,}"
            title="Use at least 3 letters."
            required
          />

          <input
            name="last_name"
            placeholder="Last Name"
            className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500"
            value={formData.last_name}
            onChange={handleChange}
            minLength="3"
            pattern="[A-Za-z]{3,}"
            title="Use at least 3 letters."
            required
          />
        </div>

        <input
          name="email"
          type="email"
          placeholder="Email"
          className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500"
          value={formData.email}
          onChange={handleChange}
          required
        />

        <div className="relative">
          <input
            name="password"
            type={showPasswords ? 'text' : 'password'}
            placeholder="Password"
            className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded-xl px-4 py-3 pr-12 outline-none focus:ring-2 focus:ring-sky-500"
            value={formData.password}
            onChange={handleChange}
            required
            minLength="8"
            pattern="(?=.*[A-Z])(?=.*\d).{8,}"
            title="Use at least 8 characters, including 1 uppercase letter and 1 number."
          />
          <button
            type="button"
            onClick={() => setShowPasswords((visible) => !visible)}
            aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
            className="absolute inset-y-0 right-3 flex cursor-pointer items-center text-blue-700 hover:text-blue-900 dark:text-sky-300 dark:hover:text-sky-200"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-xl">
              {showPasswords ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        </div>

        <div className="relative">
          <input
            name="confirm_password"
            type={showPasswords ? 'text' : 'password'}
            placeholder="Confirm Password"
            className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded-xl px-4 py-3 pr-12 outline-none focus:ring-2 focus:ring-sky-500"
            value={formData.confirm_password}
            onChange={handleChange}
            required
          />
          <button
            type="button"
            onClick={() => setShowPasswords((visible) => !visible)}
            aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
            className="absolute inset-y-0 right-3 flex cursor-pointer items-center text-blue-700 hover:text-blue-900 dark:text-sky-300 dark:hover:text-sky-200"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-xl">
              {showPasswords ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full cursor-pointer bg-blue-700 text-white py-3 rounded-xl font-medium hover:bg-blue-800 transition-colors"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>

      </form>

      <p className="mt-5 text-center text-sm text-gray-600 dark:text-gray-300">
        Have an account?{' '}
        <Link to="/login" className="font-medium text-blue-700 hover:text-blue-900 dark:text-sky-300 dark:hover:text-sky-200">
          Login
        </Link>
      </p>
    </div>
  )
}

export default RegisterForm