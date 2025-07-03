import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';
import Image from 'next/image';
import { EyeIcon } from './EyeIcon';
import { useMobileViewport } from '../hooks/useMobileViewport';

export default function UserAuthForm() {
  const router = useRouter();
  const { getMobileStyles, mobileClasses } = useMobileViewport();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const passwordsMismatch = isSignUp && confirmPassword && password !== confirmPassword;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    if (!email || !password) {
      setError('Please enter both email and password.');
      setLoading(false);
      return;
    }
    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Check your email for a confirmation link.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage('Logged in! Redirecting...');
        setTimeout(() => {
          router.push('/map');
        }, 800);
      }
    } catch (err: unknown) {
      let errorMsg = 'Something went wrong.';
      if (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string') {
        errorMsg = (err as { message?: string }).message as string;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white/80 rounded-3xl shadow-2xl p-8 flex flex-col gap-8 border border-blue-100 animate-fade-in backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3">
        {/* Logo image, no circle, no shadow, larger */}
        <Image src="/logo.png" alt="DropPoint Logo" width={80} height={80} className="w-20 h-20 object-contain mb-2" priority />
        <h1 className="text-3xl font-extrabold text-blue-700">{isSignUp ? 'Sign Up' : 'Log In'}</h1>
        <div className="text-base text-gray-500 font-medium">to DropPoint</div>
      </div>
      <form className="flex flex-col gap-5" onSubmit={handleAuth}>
        <input
          type="email"
          placeholder="Email"
          className={`w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold placeholder:font-semibold placeholder:text-gray-400 text-gray-900 text-base bg-white/90 shadow ${mobileClasses.input}`}
          style={getMobileStyles('input')}
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            className={`w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold placeholder:font-semibold placeholder:text-gray-400 text-gray-900 text-base bg-white/90 shadow pr-10 ${mobileClasses.input}`}
            style={getMobileStyles('input')}
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            required
          />
          <button
            type="button"
            className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xl font-bold focus:outline-none cursor-pointer ${mobileClasses.touchTarget}`}
            onClick={() => {
              setShowPassword((v) => !v);
            }}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <EyeIcon open={showPassword} />
          </button>
        </div>
        {isSignUp && (
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm Password"
              className={`w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold placeholder:font-semibold placeholder:text-gray-400 text-gray-900 text-base bg-white/90 shadow pr-10 ${mobileClasses.input}`}
              style={getMobileStyles('input')}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xl font-bold focus:outline-none cursor-pointer ${mobileClasses.touchTarget}`}
              onClick={() => {
                setShowConfirmPassword((v) => !v);
              }}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              <EyeIcon open={showConfirmPassword} />
            </button>
            {passwordsMismatch && (
              <div className="text-red-600 text-xs mt-1 text-center">Passwords do not match.</div>
            )}
          </div>
        )}
        <button
          type="submit"
          className={`w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-lg shadow hover:bg-blue-700 transition-all disabled:opacity-60 cursor-pointer ${mobileClasses.touchTarget}`}
          disabled={loading}
        >
          {loading ? (isSignUp ? 'Signing Up...' : 'Logging In...') : (isSignUp ? 'Sign Up' : 'Log In')}
        </button>
      </form>
      
      {/* Error and message display */}
      {error && (
        <div className="text-red-600 text-sm text-center bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}
      {message && (
        <div className="text-green-600 text-sm text-center bg-green-50 border border-green-200 rounded-lg p-3">
          {message}
        </div>
      )}
      
      <div className="text-center">
        <button
          type="button"
          className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
          onClick={() => setIsSignUp(!isSignUp)}
        >
          {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
        </button>
      </div>
    </div>
  );
}

// Add fade-in animation to Tailwind (if not already in your config):
// .animate-fade-in { animation: fadeIn 0.3s ease; }
// @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } } 