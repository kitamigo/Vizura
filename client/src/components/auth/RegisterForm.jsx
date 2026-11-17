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
    <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-800 p-10 rounded-lg shadow transition-colors duration-200">
      <h2 className="text-center text-2xl font-bold mb-4 text-indigo-500 dark:text-indigo-400">Register</h2>

      <p className="text-center text-sm text-gray-600 dark:text-gray-300">Create an account to get started.</p>

      {/* Divider */}
      <div className="flex items-center gap-4 my-6">

        <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />


        <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />

      </div>

      {error && (
        <p className="text-red-500 mb-3 text-sm">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            name="first_name"
            placeholder="First Name"
            className="w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded"
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
            className="w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded"
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
          className="w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded"
          value={formData.email}
          onChange={handleChange}
          required
        />

        <input
          name="password"
          type="password"
          placeholder="Password"
          className="w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded"
          value={formData.password}
          onChange={handleChange}
          required
          minLength="8"
          pattern="(?=.*[A-Z])(?=.*\d).{8,}"
          title="Use at least 8 characters, including 1 uppercase letter and 1 number."
        />

        <input
          name="confirm_password"
          type="password"
          placeholder="Confirm Password"
          className="w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded"
          value={formData.confirm_password}
          onChange={handleChange}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-700 dark:bg-green-600 text-white py-2 rounded hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>

      </form>

      <p className="mt-5 text-center text-sm text-gray-600 dark:text-gray-300">
        Have an account?{' '}
        <Link to="/login" className="font-medium text-indigo-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300">
          Login
        </Link>
      </p>
    </div>
  )
}

export default RegisterForm