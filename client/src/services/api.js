import axios from 'axios'

// creates the shared api client
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
const isLocalDevelopment =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
const baseURL = configuredApiUrl || (
  isLocalDevelopment
    ? 'http://localhost:5000/api'
    : 'https://vizura-server-l7d0.onrender.com/api'
)

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// adds the auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api


