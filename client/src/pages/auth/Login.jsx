import { useNavigate } from 'react-router-dom'
import LoginForm from '../../components/auth/LoginForm'
import { useAuth } from '../../context/useAuth'
import logoDark from '../../assets/logo_dark.svg'

function Login() {

  const navigate = useNavigate()

  const { login } = useAuth()

  const handleLogin = async ({ email, password }) => {

    try {

      await login(email, password)
      
    
        navigate('/app/dashboard')
      

    } catch (err) {

      console.error(err)

      console.log(err.response)
      console.log(err.response?.data)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-sky-500 px-4 py-10">
      <img src={logoDark} alt="Vizura" className="h-auto w-72 max-w-full" />
      <LoginForm onSubmit={handleLogin} />
    </div>
  )
}

export default Login