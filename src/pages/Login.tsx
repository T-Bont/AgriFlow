import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import './Login.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [farmName, setFarmName] = useState('My Farm')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  async function handleSignUp(e?: FormEvent) {
    e?.preventDefault()
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { farm_name: farmName } },
    })
    setLoading(false)
    if (error) {
      setMessage(error.message)
      return
    }
    setMessage('Check your email to confirm, or sign in if you already have an account.')
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setMessage(error.message)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="login">
      <div className="login-card">
        <h1 className="login-title">AgriFlow</h1>
        <form onSubmit={handleSignIn} className="login-form">
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              inputMode="email"
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <p className="login-hint">New here? Choose a farm name for your account:</p>
          <label>
            <span>Farm name</span>
            <input
              type="text"
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
              placeholder="My Farm"
            />
          </label>
          {message && <p className="login-message">{message}</p>}
          <div className="login-actions">
            <button type="submit" disabled={loading}>
              {loading ? '…' : 'Sign in'}
            </button>
            <button
              type="button"
              className="login-secondary"
              onClick={handleSignUp}
              disabled={loading}
            >
              Create account
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
