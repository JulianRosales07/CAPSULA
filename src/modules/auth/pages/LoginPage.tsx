import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useUiStore } from '../../../store/ui-store'
import { login as loginRequest } from '../../../services/api/auth'
import { MoonIcon, SunIcon } from '../../../components/icons'
import  CapsulaLogo  from '../../../assets/Capsulas.png'

type LoginFormValues = {
  email: string
  password: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const login = useUiStore((state) => state.login)
  const theme = useUiStore((state) => state.theme)
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const { register, handleSubmit, formState } = useForm<LoginFormValues>({
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await loginRequest(values.email, values.password)
      // Pasamos storeType al store de Zustand para que esté disponible en toda la app
      login(
        {
          ...result.user,
          storeType: result.user.storeType ?? null,
        },
        result.accessToken,
        result.refreshToken
      )
      toast.success('Bienvenido al panel')

      const SUPER_ADMIN_ROLE = 'Super Administrador'
      const redirectTo = result.user.role === SUPER_ADMIN_ROLE ? '/droguerias' : '/dashboard'
      navigate(redirectTo, { replace: true })
    } catch (error: any) {
      let message = 'Credenciales inválidas'
      if (error.response) {
        message = error.response.data?.message || message
      } else if (error.request) {
        message = 'No se pudo establecer conexión con el servidor. Verifique si el backend está corriendo.'
      } else {
        message = error.message || message
      }
      toast.error(message)
    }
  })

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 lg:p-8 dark:bg-slate-950 font-sans relative overflow-hidden">
      {/* Background ring decoration */}
      <div className="absolute top-0 left-0 w-96 h-96 rounded-full bg-cyan-400/20 -translate-x-1/3 -translate-y-1/3 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-blue-400/10 translate-x-1/3 translate-y-1/3 blur-3xl pointer-events-none" />

      {/* Botón de tema, fijo en la esquina superior derecha */}
      <button
        type="button"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-sm font-medium text-slate-600 shadow-sm backdrop-blur transition hover:bg-white dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 lg:right-8 lg:top-8"
      >
        {theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
        <span className="hidden sm:inline">{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
      </button>

      {/* Main card container */}
      <div className="relative w-full max-w-7xl 2xl:max-w-[1440px] bg-white rounded-3xl shadow-2xl overflow-hidden grid lg:grid-cols-2 min-h-[660px] lg:min-h-[720px] border border-slate-200/50 dark:border-slate-800 dark:bg-slate-900 z-10 transition-all duration-300">

        {/* Left Side: Stethoscope image & logo overlay */}
        <section className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 overflow-hidden bg-slate-900 text-white">
          {/* Stethoscope Background Image with Overlay */}
          <div
            className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-luminosity pointer-events-none"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1000&q=80')`
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900/90 to-cyan-950/40 pointer-events-none" />

          {/* Cyan Concentric Rings Decoration */}
          <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full border-[20px] border-cyan-400/30 pointer-events-none" />
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full border-[20px] border-cyan-400/20 pointer-events-none" />

          {/* Logo & Brand Name */}
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <img src={CapsulaLogo} alt="Capsula" className="h-16 w-16" />
              <span className="text-xl font-semibold tracking-wide text-white">Cápsula</span>
            </div>
          </div>

          {/* Bottom Copyright Text */}
          <div className="relative z-10 text-xs text-slate-400 font-medium">
            Desarrollado por: Julián David Rosales Portilla
          </div>
        </section>

        {/* Right Side: Form */}
        <section className="flex flex-col justify-between p-8 sm:p-12 xl:p-16 bg-white dark:bg-slate-900">



          {/* Center Form Section */}
          <div className="w-full max-w-md mx-auto my-auto">
            {/* Center Logo */}
            <div className="flex justify-center mb-5">
              <img src={CapsulaLogo} alt="Capsula" className="h-28 w-28 drop-shadow-sm" />
            </div>

            {/* Title & Subtitle */}
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
                Iniciar Sesión
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-2">
                Ingresa a tu cuenta de membresía
              </p>
            </div>

            {/* Form Inputs */}
            <form onSubmit={onSubmit} className="space-y-4">
              {/* Username/Email Input Container */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 pointer-events-none">
                  {/* User Icon */}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <input
                  type="email"
                  placeholder="Usuario o Correo Electrónico"
                  className="w-full rounded-full border border-slate-200 bg-slate-50/50 pl-11 pr-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  {...register('email', { required: true })}
                />
              </div>

              {/* Password Input Container */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 pointer-events-none">
                  {/* Lock Icon */}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  type="password"
                  placeholder="Contraseña"
                  className="w-full rounded-full border border-slate-200 bg-slate-50/50 pl-11 pr-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  {...register('password', { required: true, minLength: 6 })}
                />
              </div>



              {/* Submit Button */}
              <button
                type="submit"
                disabled={formState.isSubmitting}
                className="w-full rounded-full bg-cyan-400 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-400/25 transition hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 disabled:opacity-60"
              >
                {formState.isSubmitting ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>

          </div>



        </section>
      </div>
    </div>
  )
}
