import axios from 'axios'
import { encryptEnvelope, decryptEnvelope, type EncryptedEnvelope } from '../../shared/utils/crypto'

// Normaliza la URL base quitando slashes finales, para evitar dobles "//"
// cuando la variable de entorno VITE_API_URL viene con un "/" al final
// (ej. "https://api.com/" en vez de "https://api.com/api").
// El fallback apunta al backend en Render por si VITE_API_URL no llega a
// definirse en el entorno de build (ej. variable no configurada en el hosting).
const rawBaseUrl = import.meta.env.VITE_API_URL || 'https://drogueriaback.onrender.com/api'
const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, '')

export const apiClient = axios.create({
  baseURL: normalizedBaseUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-App-Client': 'drogueria-web',
  },
})

apiClient.interceptors.request.use((config) => {
  config.headers['X-Requested-From'] = 'dashboard'
  
  // Agregar token JWT si existe
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // Cifrado híbrido (RSA Asimétrico + Cifrado César) para todas las peticiones salientes (login, ventas, etc.)
  if (config.data && typeof config.data === 'object' && !(config.data instanceof FormData) && !(config.data as any).encrypted) {
    config.data = encryptEnvelope(config.data)
  }
  
  return config
})

// ===== Renovación automática de sesión =====
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) return null

  try {
    const payload = encryptEnvelope({ refreshToken })
    const { data } = await axios.post<{ success: boolean; data: any; encrypted?: boolean }>(
      `${normalizedBaseUrl}/auth/refresh`,
      payload,
    )
    const decryptedData = (data as any)?.encrypted ? decryptEnvelope(data as any) : data
    localStorage.setItem('access_token', decryptedData.data.accessToken)
    localStorage.setItem('refresh_token', decryptedData.data.refreshToken)
    return decryptedData.data.accessToken
  } catch {
    return null
  }
}

function clearSessionAndRedirect() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('drogueria-user')
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

apiClient.interceptors.response.use(
  (response) => {
    // Descifrar automáticamente respuestas cifradas con RSA + César
    if (response.data && typeof response.data === 'object' && (response.data as any).encrypted) {
      try {
        response.data = decryptEnvelope(response.data as EncryptedEnvelope)
      } catch (err) {
        console.error('Error descifrando respuesta del servidor:', err)
      }
    }
    return response
  },
  async (error) => {
    // Descifrar cuerpo de error si viene cifrado
    if (error.response?.data && typeof error.response.data === 'object' && (error.response.data as any).encrypted) {
      try {
        error.response.data = decryptEnvelope(error.response.data as EncryptedEnvelope)
      } catch (err) {
        console.error('Error descifrando respuesta de error:', err)
      }
    }
    const originalRequest = error.config
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/refresh')

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true

      // Si ya hay un refresh en curso (varias peticiones fallaron a la vez),
      // todas esperan el MISMO refresh en vez de disparar uno cada una.
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null
        })
      }

      const newToken = await refreshPromise
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return apiClient(originalRequest)
      }

      clearSessionAndRedirect()
    }

    return Promise.reject(error)
  },
)

export async function simulateRequest<T>(data: T, delay = 250): Promise<T> {
  await new Promise((resolve) => window.setTimeout(resolve, delay))
  return structuredClone(data)
}
