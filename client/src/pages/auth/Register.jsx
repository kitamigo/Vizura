import { useNavigate } from 'react-router-dom'
import RegisterForm from '../../components/auth/RegisterForm'
import { useAuth } from '../../context/useAuth'
import logoDark from '../../assets/logo_dark.svg'

function Register() {

  const navigate = useNavigate()

  const { register } = useAuth()

  const handleRegister = async (formData) => {

    try {

      await register(formData)

      navigate('/app/dashboard')

    } catch (err) {

      console.error(err)

      console.log(err.response)
      console.log(err.response?.data)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-sky-300 px-4 py-10">
      <img src={logoDark} alt="Vizura" className="h-auto w-72 max-w-full" />
      <RegisterForm onSubmit={handleRegister} />
    </div>
  )
}

export default Register