import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { supabase } from '../utils/supabaseClient';
import { ensureUserProfile } from '../utils/profile';
import { EyeIcon } from './EyeIcon';
import { POST_LOGIN_SPINNER_MS, AUTH_PROVIDERS, type AuthProvider } from '../../constants';

const PROVIDERS: Record<AuthProvider, { label: string; icon: React.ReactNode }> = {
  google: {
    label: 'Google',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9H1.3v3.1C3.3 21.3 7.3 24 12 24z" />
        <path fill="#FBBC05" d="M5.3 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.6.4-2.4V6.5H1.3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.5l4-3.1z" />
        <path fill="#EA4335" d="M12 4.7c1.8 0 3.3.6 4.6 1.8l3.4-3.4C18 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.5l4 3.1c1-2.8 3.6-4.9 6.7-4.9z" />
      </svg>
    ),
  },
  apple: {
    label: 'Apple',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M16.4 12.7c0-2.5 2-3.7 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.8-1.7 0-3.2 1-4.1 2.5-1.8 3-.5 7.5 1.3 10 .8 1.2 1.8 2.6 3.1 2.5 1.3 0 1.7-.8 3.3-.8 1.5 0 1.9.8 3.3.8 1.4 0 2.2-1.2 3-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4zM13.9 5.4c.7-.8 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1.1 3 1.1.1 2.3-.6 3-1.4z" />
      </svg>
    ),
  },
  facebook: {
    label: 'Facebook',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="12" fill="#1877F2" />
        <path fill="#fff" d="M16.7 15.5l.5-3.5h-3.4V9.7c0-1 .5-1.9 2-1.9h1.5v-3s-1.4-.2-2.7-.2c-2.7 0-4.5 1.6-4.5 4.6V12H7v3.5h3.1V24h3.7v-8.5h2.9z" />
      </svg>
    ),
  },
};

const getSiteUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '');
  return '';
};

/** Human-readable list of what a password still needs, empty when it's fine. */
const missingPasswordRules = (pwd: string): string[] => {
  const missing: string[] = [];
  if (pwd.length < 8) missing.push('8+ characters');
  if (!/[A-Z]/.test(pwd)) missing.push('an uppercase letter');
  if (!/[a-z]/.test(pwd)) missing.push('a lowercase letter');
  if (!/\d/.test(pwd)) missing.push('a number');
  if (!/[^A-Za-z0-9]/.test(pwd)) missing.push('a symbol');
  return missing;
};

const joinList = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/**
 * Sign in / create account. One grouped form, one filled button, one link to
 * switch modes. Nothing on the screen that doesn't move the user forward.
 */
export default function UserAuthForm() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // An OAuth round-trip that failed comes back to this page with the reason.
  useEffect(() => {
    const reason = router.query.auth_error;
    if (typeof reason === 'string' && reason) {
      setError(reason);
      void router.replace('/', undefined, { shallow: true });
    }
  }, [router]);

  const signInWith = async (provider: AuthProvider) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    const siteUrl = getSiteUrl();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: siteUrl ? `${siteUrl}/auth/callback` : undefined,
        ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : {}),
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
    // Otherwise the browser is on its way to the provider.
  };

  const missing = isSignUp && password ? missingPasswordRules(password) : [];
  const mismatch = isSignUp && confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit = isSignUp
    ? Boolean(email && firstName.trim() && lastName.trim() && password && confirmPassword) && missing.length === 0 && !mismatch
    : Boolean(email && password);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFirstName('');
    setLastName('');
    setError(null);
    setShowPassword(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const siteUrl = getSiteUrl();
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: siteUrl ? `${siteUrl}/auth/callback` : undefined,
            data: { first_name: firstName.trim(), last_name: lastName.trim() },
          },
        });
        if (signUpError) throw signUpError;
        setSentTo(email);
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      await ensureUserProfile(data.user);

      // Hold the welcome state briefly so the transition reads as "you're in".
      setIsLoggingIn(true);
      await new Promise<void>(resolve => setTimeout(resolve, POST_LOGIN_SPINNER_MS));
      await router.push('/map');
      return;
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string'
        ? (err as { message: string }).message
        : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
      setIsLoggingIn(false);
    }
  };

  const logo = <Image src="/logo.png" alt="" width={72} height={72} className="w-[72px] h-[72px] object-contain" priority />;

  if (sentTo) {
    return (
      <div className="w-full max-w-sm flex flex-col items-center text-center gap-5">
        {logo}
        <div>
          <h1 className="text-title-1 font-bold">Check your email</h1>
          <p className="text-subhead text-ink-2 mt-2">
            We sent a confirmation link to <span className="text-ink font-medium">{sentTo}</span>. Open it to activate your account, then sign in.
          </p>
        </div>
        <button
          type="button"
          className="ios-button ios-button-primary"
          onClick={() => { setSentTo(null); setIsSignUp(false); resetForm(); }}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  if (isLoggingIn) {
    return (
      <div className="w-full max-w-sm flex flex-col items-center text-center gap-5">
        {logo}
        <div className="w-8 h-8 border-[3px] border-surface-2 border-t-accent rounded-full animate-spin" />
        <div>
          <h1 className="text-title-2 font-bold">Welcome back</h1>
          <p className="text-subhead text-ink-2 mt-1">Opening your map…</p>
        </div>
      </div>
    );
  }

  const fieldClass = 'ios-field';

  return (
    <div className="w-full max-w-sm flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3">
        {logo}
        <h1 className="ios-large-title">{isSignUp ? 'Create account' : 'DropPoint'}</h1>
        {!isSignUp && <p className="text-subhead text-ink-2 -mt-1">Your property documents, on a map.</p>}
      </div>

      {AUTH_PROVIDERS.length > 0 && (
        <div className="flex flex-col gap-3">
          {AUTH_PROVIDERS.map(provider => (
            <button
              key={provider}
              type="button"
              className="ios-button bg-surface text-ink gap-2.5 shadow-[0_0_0_0.5px_var(--color-hairline),0_1px_2px_rgba(0,0,0,0.04)]"
              onClick={() => signInWith(provider)}
              disabled={loading}
            >
              {PROVIDERS[provider].icon}
              Continue with {PROVIDERS[provider].label}
            </button>
          ))}
          <div className="flex items-center gap-3 text-footnote text-ink-2 px-2" aria-hidden="true">
            <span className="flex-1 h-px bg-hairline/70" />
            or
            <span className="flex-1 h-px bg-hairline/70" />
          </div>
        </div>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleAuth} noValidate>
        <div className="ios-group">
          {isSignUp && (
            <div className="grid grid-cols-2 divide-x divide-hairline/60">
              <input
                type="text"
                placeholder="First name"
                className={fieldClass}
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                autoComplete="given-name"
                required
              />
              <input
                type="text"
                placeholder="Last name"
                className={fieldClass}
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                autoComplete="family-name"
                required
              />
            </div>
          )}
          <div className={isSignUp ? 'border-t border-hairline/60' : ''}>
            <input
              type="email"
              placeholder="Email"
              className={fieldClass}
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              required
            />
          </div>
          <div className="relative border-t border-hairline/60">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              className={`${fieldClass} pr-12`}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 tap-target flex items-center justify-center text-ink-2 ios-press"
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
          {isSignUp && (
            <div className="border-t border-hairline/60">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm password"
                className={fieldClass}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
          )}
        </div>

        {isSignUp && (missing.length > 0 || mismatch) && (
          <p className={`text-footnote px-4 -mt-1 ${mismatch ? 'text-danger' : 'text-ink-2'}`} aria-live="polite">
            {mismatch ? 'Passwords don’t match.' : `Password needs ${joinList(missing)}.`}
          </p>
        )}

        {error && (
          <p className="text-footnote text-danger px-4 -mt-1" role="alert">{error}</p>
        )}

        <button type="submit" className="ios-button ios-button-primary" disabled={loading || !canSubmit}>
          {loading ? (isSignUp ? 'Creating account…' : 'Signing in…') : (isSignUp ? 'Create account' : 'Sign in')}
        </button>
      </form>

      <button
        type="button"
        className="text-subhead text-accent text-center ios-press"
        onClick={() => { setIsSignUp(v => !v); resetForm(); }}
      >
        {isSignUp ? 'Have an account? Sign in' : 'New here? Create an account'}
      </button>
    </div>
  );
}
