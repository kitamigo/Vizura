import { useState } from 'react'
import { Link } from 'react-router-dom'

function LoginForm({ onSubmit }) {

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()

    onSubmit({
      email,
      password
    })
  }

  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm transition-colors duration-200">

      {/* Heading */}
      <h1 className="text-center text-2xl font-bold mb-2 text-blue-700 dark:text-sky-300">
        Sign In
      </h1>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Email */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Email
          </label>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500"
            required
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Password
          </label>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded-xl px-4 py-3 pr-20 outline-none focus:ring-2 focus:ring-sky-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-3 flex cursor-pointer items-center text-blue-700 hover:text-blue-900 dark:text-sky-300 dark:hover:text-sky-200"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-xl">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>

          {/* Forgot Password */}
          <div className="flex justify-end mt-2">

            <button
              type="button"
              className="text-sm text-blue-700 dark:text-sky-300 hover:text-blue-900 dark:hover:text-sky-200"
            >
              Forgot Password?
            </button>

          </div>
        </div>

        {/* Login Button */}
        <button
          type="submit"
          className="w-full cursor-pointer bg-blue-700 text-white py-3 rounded-xl font-medium hover:bg-blue-800 transition-colors"
        >
          Sign In
        </button>

      </form>

      {/* Divider */}
      <div className="flex items-center gap-4 my-6">

        <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />

        <span className="text-sm text-gray-700 dark:text-gray-400 whitespace-nowrap">
          New to Vizura?
        </span>

        <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />

      </div>

      {/* Create Account */}
      <Link
        to="/register"
        className="block text-center py-3 rounded-xl font-medium text-blue-700 dark:text-sky-300 hover:text-blue-900 dark:hover:text-sky-200 transition-colors"
      >
        Create Account
      </Link>

    </div>
  )
}

export default LoginForm