import { 
  useState 
} from 'react'
import { AuthContext } from './authContextValue'

import {
  loginUser,
  registerUser
} from '../services/authService'

export function AuthProvider({ children }) {

  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user')
    return storedUser ? JSON.parse(storedUser) : null
  })

  // LOGIN
  const login = async (email, password) => {

    const data = await loginUser(email, password)

    setUser(data.user)

    localStorage.setItem(
      'user',
      JSON.stringify(data.user)
    )

    return data
  }

  // REGISTER
  const register = async (userData) => {

    const data = await registerUser(userData)

    setUser(data.user)

    localStorage.setItem(
      'user',
      JSON.stringify(data.user)
    )

    return data
  }

  // LOGOUT
  const logout = () => {
    setUser(null)

    localStorage.removeItem('user')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
