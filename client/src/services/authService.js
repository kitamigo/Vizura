import axios from 'axios'

// create the auth service
const authApi = axios.create({
  baseURL: import.meta.env.VITE_AUTH_URL || 'http://localhost:5001/api',
  headers: { 'Content-Type': 'application/json' }
})

// handle login and registration requests
export async function loginUser(email, password) {
  const response = await authApi.post('/auth/login', { email, password })

  return response.data
}

export async function registerUser(userData) {
  const response = await authApi.post('/auth/register', userData)

  return response.data
}
