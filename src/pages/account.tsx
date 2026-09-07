import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { WebSidebar } from '../components/WebSidebar';
import { ActionSheet } from '../components/ActionSheet';
import { supabase } from '../utils/supabaseClient';
import { getUserUsageBytes, formatBytes } from '../utils/usage';
import { FREE_TIER_MAX_BYTES, FREE_TIER_GB } from '../../constants';
import { withAuth } from '../components/withAuth';
import { useToast } from '../contexts/ToastContext';
import { logger } from '../utils/logger';

// One question at a time, asked only when the user taps the row.
const PROFILE_QUESTIONS = {
  userType: { label: 'I’m a', options: ['Real Estate Agent', 'Property Manager', 'Investor', 'Homeowner', 'Developer', 'Admin', 'Other'] },
  propertyCount: { label: 'I manage', options: ['1–5 properties', '6–20 properties', '21–100 properties', '100+ properties'] },
  useCase: { label: 'I use it for', options: ['Document storage', 'Client management', 'Property tracking', 'Portfolio organization', 'Team collaboration', 'Personal use'] },
} as const;
type ProfileKey = keyof typeof PROFILE_QUESTIONS;

function getAvatarColor(str: string): string {
  const palette = ['#0a7aff', '#5856d6', '#34c759', '#ff9500', '#ff2d55', '#af52de', '#00c7be', '#ff3b30'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

/**
 * Settings-style account screen: inset grouped lists, one value per row,
 * pickers as action sheets, sign out on its own at the bottom.
 */
function AccountPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [usageBytes, setUsageBytes] = useState(0);
  const [email, setEmail] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [profile, setProfile] = useState<Record<ProfileKey, string>>({ userType: '', propertyCount: '', useCase: '' });
  const [picker, setPicker] = useState<ProfileKey | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? null);
      setFirstName((user.user_metadata?.first_name as string) || '');
      setLastName((user.user_metadata?.last_name as string) || '');
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('user_type, property_count, use_case')
          .eq('user_id', user.id)
          .single();
        if (data) {
          setProfile({ userType: data.user_type || '', propertyCount: data.property_count || '', useCase: data.use_case || '' });
        }
      } catch {}
      try {
        setUsageBytes(await getUserUsageBytes(user.id));
      } catch (error) {
        logger.error('Error loading usage:', error);
      }
      setLoading(false);
    };
    init();
  }, []);

  const saveName = async () => {
    setNameSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { first_name: firstName, last_name: lastName, full_name: [firstName, lastName].filter(Boolean).join(' ') },
      });
      if (error) throw error;
      setIsEditingName(false);
    } catch {
      showToast('Couldn’t save your name. Please try again.');
    } finally {
      setNameSaving(false);
    }
  };

  const saveProfileAnswer = async (key: ProfileKey, value: string) => {
    const next = { ...profile, [key]: profile[key] === value ? '' : value };
    setProfile(next);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('user_profiles')
        .update({
          user_type: next.userType || null,
          property_count: next.propertyCount || null,
          use_case: next.useCase || null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
      if (error) throw error;
    } catch {
      showToast('Couldn’t save. Please try again.');
    }
  };

  const signOut = async () => {
    try {
      try { sessionStorage.clear(); } catch {}
      await supabase.auth.signOut();
    } finally {
      window.location.href = '/';
    }
  };

  const pct = Math.min(100, Math.round((usageBytes / FREE_TIER_MAX_BYTES) * 100));
  const displayName = [firstName, lastName].filter(Boolean).join(' ');
  const initials = displayName
    ? displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (email?.[0] ?? '?').toUpperCase();

  const valueRow = (key: ProfileKey) => (
    <button key={key} type="button" className="ios-row ios-row-press" onClick={() => setPicker(key)}>
      <span className="flex-1 text-body whitespace-nowrap">{PROFILE_QUESTIONS[key].label}</span>
      <span className="text-body text-ink-2 truncate max-w-[55%]">{profile[key] || 'Choose'}</span>
      <ChevronRightIcon className="ios-chevron w-4 h-4" strokeWidth={2.5} />
    </button>
  );

  return (
    <div className="flex min-h-dvh bg-ground">
      <Head>
        <title>Account - DropPoint</title>
      </Head>
      <WebSidebar />
      <div className="flex-1 overflow-auto">
        <div className="max-w-xl mx-auto px-4 pb-tabbar" style={{ paddingTop: 'calc(var(--safe-top) + 16px)' }}>
          <h1 className="ios-large-title mb-4">Account</h1>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="ios-group p-4 animate-pulse">
                  <div className="h-4 bg-surface-2 rounded w-1/3 mb-3" />
                  <div className="h-3 bg-surface-2 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Identity */}
              <div className="ios-group">
                {!isEditingName ? (
                  <button type="button" className="ios-row ios-row-press" onClick={() => setIsEditingName(true)}>
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-white text-title-3 font-semibold flex-shrink-0 select-none"
                      style={{ backgroundColor: getAvatarColor(displayName || email || '?') }}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-title-3 font-semibold truncate">
                        {displayName || <span className="text-ink-2 font-normal">Add your name</span>}
                      </div>
                      <div className="text-subhead text-ink-2 truncate">{email}</div>
                    </div>
                    <ChevronRightIcon className="ios-chevron w-4 h-4" strokeWidth={2.5} />
                  </button>
                ) : (
                  <div>
                    <input
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      className="ios-field"
                      placeholder="First name"
                      autoComplete="given-name"
                      autoFocus
                    />
                    <input
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      className="ios-field border-t border-hairline/60"
                      placeholder="Last name"
                      autoComplete="family-name"
                    />
                    <div className="flex border-t border-hairline/60 divide-x divide-hairline/60">
                      <button type="button" className="flex-1 h-11 text-body text-accent ios-press" disabled={nameSaving} onClick={() => setIsEditingName(false)}>
                        Cancel
                      </button>
                      <button type="button" className="flex-1 h-11 text-body font-semibold text-accent ios-press" disabled={nameSaving} onClick={saveName}>
                        {nameSaving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Storage */}
              <div>
                <div className="ios-group-label">Storage</div>
                <div className="ios-group">
                  <div className="ios-row flex-col items-stretch gap-2 py-3">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-body">{formatBytes(usageBytes)} used</span>
                      <span className="text-subhead text-ink-2 whitespace-nowrap">of {FREE_TIER_GB} GB</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: pct >= 90 ? '#ff3b30' : pct >= 70 ? '#ff9500' : '#0a7aff' }}
                      />
                    </div>
                  </div>
                </div>
                <p className="text-footnote text-ink-2 px-4 pt-2">Paid plans are coming soon.</p>
              </div>

              {/* About you */}
              <div>
                <div className="ios-group-label">About you</div>
                <div className="ios-group">
                  {(Object.keys(PROFILE_QUESTIONS) as ProfileKey[]).map(valueRow)}
                </div>
                <p className="text-footnote text-ink-2 px-4 pt-2">Optional. Helps us build the right things for you.</p>
              </div>

              {profile.userType === 'Admin' && (
                <div className="ios-group">
                  <Link href="/admin" className="ios-row ios-row-press">
                    <span className="flex-1 text-body">Admin configuration</span>
                    <ChevronRightIcon className="ios-chevron w-4 h-4" strokeWidth={2.5} />
                  </Link>
                </div>
              )}

              <div className="ios-group">
                <button type="button" className="ios-row ios-row-press justify-center text-body text-danger" onClick={signOut}>
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
        <MobileBottomNav />
      </div>

      {picker && (
        <ActionSheet
          open
          onClose={() => setPicker(null)}
          title={PROFILE_QUESTIONS[picker].label}
          groups={[
            PROFILE_QUESTIONS[picker].options.map(option => ({
              label: option,
              selected: profile[picker] === option,
              onSelect: () => saveProfileAnswer(picker, option),
            })),
          ]}
        />
      )}
    </div>
  );
}

export default withAuth(AccountPage, { requireAuth: true });
