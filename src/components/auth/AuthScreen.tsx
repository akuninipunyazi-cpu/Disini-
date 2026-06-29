import { FormEvent, useState, useEffect } from 'react';
import { LocateFixed, LogIn, UserPlus, ShieldAlert, KeyRound, Mail, ArrowLeft } from 'lucide-react';
import { signInWithPassword, signUpWithPassword, resetPasswordForEmail, updatePassword } from '../../services/authService';
import { AuthAccount } from '../../types';

interface AuthScreenProps {
  onAuthSuccess: (account: AuthAccount) => void;
}

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

export function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Deteksi jika user datang dari link reset password
  useEffect(() => {
    if (window.location.hash.includes('type=recovery') || window.location.href.includes('reset-password')) {
      setMode('reset');
    }
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'signup') {
        if (username.includes(' ')) throw new Error('Username tidak boleh mengandung spasi.');
        const account = await signUpWithPassword(email, password, username);
        onAuthSuccess(account);
      } else if (mode === 'login') {
        const account = await signInWithPassword(email, password);
        onAuthSuccess(account);
      } else if (mode === 'forgot') {
        await resetPasswordForEmail(email);
        setMessage('Instruksi reset password telah dikirim ke email Anda.');
      } else if (mode === 'reset') {
        await updatePassword(password);
        setMessage('Password berhasil diperbarui. Silakan masuk.');
        setMode('login');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }

  const isSignUp = mode === 'signup';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';

  return (
    <main className="login-shell">
      <section className="login-panel auth-card">
        <div className="login-head">
          <div className="brand-mark">
            <LocateFixed size={24} aria-hidden="true" />
          </div>
          <div>
            <p className="eyebrow">DiSini! Surabaya</p>
            <h1>
              {isSignUp && 'Buat Akun'}
              {mode === 'login' && 'Masuk Dashboard'}
              {isForgot && 'Lupa Password'}
              {isReset && 'Update Password'}
            </h1>
            <p>
              {isSignUp && 'Bergabung untuk mulai menggunakan layanan kami.'}
              {mode === 'login' && 'Silakan masuk untuk melanjutkan ke dashboard Anda.'}
              {isForgot && 'Masukkan email untuk menerima link reset password.'}
              {isReset && 'Masukkan password baru Anda.'}
            </p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {!isForgot && !isReset && isSignUp && (
            <label>
              Username (Tanpa spasi)
              <input
                required
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Contoh: zidan_keren"
              />
            </label>
          )}
          
          {!isReset && (
            <label>
              {isSignUp || isForgot ? 'Email Aktif' : 'Email atau Username'}
              <input
                required
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@contoh.com"
              />
            </label>
          )}

          {!isForgot && (
            <label>
              {isReset ? 'Password Baru' : 'Password'}
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>
          )}

          {error && (
            <div className="auth-error">
              <ShieldAlert size={16} />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="form-status">
              <span>{message}</span>
            </div>
          )}

          <button className="primary-action full-width" disabled={loading} type="submit">
            {isSignUp ? <UserPlus size={18} /> : isForgot ? <Mail size={18} /> : isReset ? <KeyRound size={18} /> : <LogIn size={18} />}
            {loading ? 'Memproses...' : (
              isSignUp ? 'Daftar Sekarang' : 
              isForgot ? 'Kirim Link Reset' : 
              isReset ? 'Update Password' : 
              'Masuk Sekarang'
            )}
          </button>
        </form>

        <div className="auth-footer">
          {mode === 'login' && (
            <button type="button" className="link-btn" onClick={() => setMode('forgot')}>
              Lupa password?
            </button>
          )}

          {(isForgot || isSignUp) && (
            <p className="auth-switch">
              <button type="button" onClick={() => setMode('login')}>
                <ArrowLeft size={14} /> Kembali ke Masuk
              </button>
            </p>
          )}

          {mode === 'login' && (
            <p className="auth-switch">
              Belum memiliki akun?
              <button type="button" onClick={() => setMode('signup')}>
                Daftar di sini
              </button>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

