import { logger } from '../utils/logger';
import { useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { supabase } from '../utils/supabaseClient';
import { EyeIcon } from './EyeIcon';
import { POST_LOGIN_SPINNER_MS } from '../../constants';

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

      // First sign-in: seed the profile row from the sign-up metadata.
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name')
        .eq('user_id', data.user.id)
        .single();
      if (!profile?.first_name) {
        const { error: profileError } = await supabase.from('user_profiles').upsert({
          user_id: data.user.id,
          first_name: data.user.user_metadata?.first_name || null,
          last_name: data.user.user_metadata?.last_name || null,
          phone_number: null,
          contact_preference: 'email',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (profileError) logger.error('Error saving profile:', profileError);
      }

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
