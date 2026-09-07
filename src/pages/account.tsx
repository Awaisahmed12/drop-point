import React, { useEffect, useState } from 'react';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { WebSidebar } from '../components/WebSidebar';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../utils/supabaseClient';
import { getUserUsageBytes, formatBytes } from '../utils/usage';
import { FREE_TIER_MAX_BYTES, FREE_TIER_GB, TOAST_SUCCESS_MS } from '../../constants';
import { withAuth } from '../components/withAuth';

// Deterministic avatar color from a string
function getAvatarColor(str: string): string {
  const palette = [
    '#4f46e5', '#0891b2', '#059669', '#d97706',
    '#dc2626', '#7c3aed', '#db2777', '#0284c7',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [usageBytes, setUsageBytes] = useState(0);
  const [email, setEmail] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState(false);

  // Profile enrichment fields
  const [userType, setUserType] = useState<string>('');
  const [propertyCount, setPropertyCount] = useState<string>('');
  const [useCase, setUseCase] = useState<string>('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? null);
      setFirstName((user.user_metadata?.first_name as string) || '');
      setLastName((user.user_metadata?.last_name as string) || '');
      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('user_type, property_count, use_case')
          .eq('user_id', user.id)
          .single();
        if (profile) {
          setUserType(profile.user_type || '');
          setPropertyCount(profile.property_count || '');
          setUseCase(profile.use_case || '');
        }
      } catch {}
      const total = await getUserUsageBytes(user.id);
      setUsageBytes(total);
      setLoading(false);
    };
    init();
  }, []);

  const handleSaveProfile = async () => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('user_profiles')
          .update({
            user_type: userType || null,
            property_count: propertyCount || null,
            use_case: useCase || null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
        if (error) {
          setProfileError('Failed to save. Please try again.');
        } else {
          setIsEditingProfile(false);
          setProfileSuccess(true);
          setTimeout(() => setProfileSuccess(false), TOAST_SUCCESS_MS);
        }
      }
    } catch {
      setProfileError('Failed to save. Please try again.');
    } finally {
      setProfileLoading(false);
    }
  };

  const limitGB = FREE_TIER_GB;
  const pct = Math.min(100, Math.round((usageBytes / FREE_TIER_MAX_BYTES) * 100));
  const displayName = [firstName, lastName].filter(Boolean).join(' ');
  const initials = displayName
    ? displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (email?.[0] ?? '?').toUpperCase();
  const avatarColor = getAvatarColor(displayName || email || '?');

  const SectionHeader = ({ label }: { label: string }) => (
    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">{label}</p>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Head>
        <title>Account - DropPoint</title>
      </Head>
      <WebSidebar />
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-4 py-8 pb-28">

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">

              {/* ── Identity ─────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-5">
                  <SectionHeader label="Account" />
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-semibold flex-shrink-0 select-none"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {initials}
                    </div>

                    {/* Name + Email */}
                    <div className="flex-1 min-w-0">
                      {!isEditingName ? (
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="text-sm font-semibold text-gray-900 leading-snug">
                              {displayName || <span className="text-gray-400 font-normal">Add your name</span>}
                            </div>
                            <div className="text-sm text-gray-500 truncate">{email}</div>
                          </div>
                          <button
                            onClick={() => setIsEditingName(true)}
                            className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
                            title="Edit name"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              value={firstName}
                              onChange={e => setFirstName(e.target.value)}
                              className="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                              placeholder="First name"
                              autoComplete="given-name"
                              autoFocus
                            />
                            <input
                              value={lastName}
                              onChange={e => setLastName(e.target.value)}
                              className="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                              placeholder="Last name"
                              autoComplete="family-name"
                            />
                          </div>
                          {nameError && <p className="text-xs text-red-600">{nameError}</p>}
                          <div className="flex gap-2">
                            <button
                              disabled={nameSaving}
                              onClick={async () => {
                                setNameSaving(true);
                                setNameError(null);
                                try {
                                  const { error } = await supabase.auth.updateUser({
                                    data: { first_name: firstName, last_name: lastName, full_name: [firstName, lastName].filter(Boolean).join(' ') }
                                  });
                                  if (error) { setNameError('Failed to save. Please try again.'); }
                                  else { setIsEditingName(false); }
                                } catch { setNameError('Failed to save. Please try again.'); }
                                finally { setNameSaving(false); }
                              }}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
                            >
                              {nameSaving ? 'Saving\u2026' : 'Save'}
                            </button>
                            <button
                              disabled={nameSaving}
                              onClick={() => { setIsEditingName(false); setNameError(null); }}
                              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sign out */}
                <div className="border-t border-gray-100 px-5 py-3">
                  <button
                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                    onClick={async () => {
                      try {
                        try { sessionStorage.removeItem('droppoint-map-position'); } catch {}
                        try { sessionStorage.removeItem('droppoint-properties-cache'); } catch {}
                        await supabase.auth.signOut();
                      } finally {
                        window.location.href = '/';
                      }
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </div>

              {/* ── Profile ──────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <SectionHeader label="Profile" />
                  <div className="flex items-center gap-3 -mt-3">
                    {profileSuccess && !isEditingProfile && (
                      <span className="text-xs text-green-600 font-medium">Saved</span>
                    )}
                    {!isEditingProfile && (
                      <button
                        onClick={() => setIsEditingProfile(true)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        {userType || propertyCount || useCase ? 'Edit' : 'Add details'}
                      </button>
                    )}
                  </div>
                </div>

                {!isEditingProfile ? (
                  !userType && !propertyCount && !useCase ? (
                    <p className="text-sm text-gray-400">No preferences set. Add details to help us improve DropPoint for you.</p>
                  ) : (
                    <div className="space-y-2">
                      {userType && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 w-20 flex-shrink-0">I&apos;m a</span>
                          <span className="text-sm text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-full font-medium">{userType}</span>
                        </div>
                      )}
                      {propertyCount && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 w-20 flex-shrink-0">I manage</span>
                          <span className="text-sm text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-full font-medium">{propertyCount}</span>
                        </div>
                      )}
                      {useCase && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 w-20 flex-shrink-0">Use case</span>
                          <span className="text-sm text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-full font-medium">{useCase}</span>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">I&apos;m a&hellip;</p>
                      <div className="flex flex-wrap gap-2">
                        {['Real Estate Agent', 'Property Manager', 'Investor', 'Homeowner', 'Developer', 'Admin', 'Other'].map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setUserType(type === userType ? '' : type)}
                            className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                              userType === type
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">I manage about&hellip;</p>
                      <div className="flex flex-wrap gap-2">
                        {['1\u20135 properties', '6\u201320 properties', '21\u2013100 properties', '100+ properties'].map(count => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => setPropertyCount(count === propertyCount ? '' : count)}
                            className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                              propertyCount === count
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {count}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">I&apos;ll use DropPoint for&hellip;</p>
                      <div className="flex flex-wrap gap-2">
                        {['Document storage', 'Client management', 'Property tracking', 'Portfolio organization', 'Team collaboration', 'Personal use'].map(use => (
                          <button
                            key={use}
                            type="button"
                            onClick={() => setUseCase(use === useCase ? '' : use)}
                            className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                              useCase === use
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {use}
                          </button>
                        ))}
                      </div>
                    </div>
                    {profileError && <p className="text-sm text-red-600">{profileError}</p>}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => { setIsEditingProfile(false); setProfileError(null); }}
                        disabled={profileLoading}
                        className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={profileLoading}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
                      >
                        {profileLoading ? 'Saving\u2026' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Admin tools ───────────────────────────────── */}
              {userType === 'Admin' && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <SectionHeader label="Admin" />
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Configuration Management
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </Link>
                </div>
              )}

              {/* ── Storage ───────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-1">
                  <SectionHeader label="Storage" />
                  <span className="text-xs text-gray-400 -mt-3">Free plan &middot; {limitGB} GB</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium text-gray-900">{formatBytes(usageBytes)}</span>
                  <span className="text-gray-400 text-xs">{pct}% of {limitGB} GB</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#3b82f6',
                    }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2.5">Paid plans coming soon.</p>
              </div>

            </div>
          )}
        </div>
        <MobileBottomNav />
      </div>
    </div>
  );
}

export default withAuth(AccountPage, { requireAuth: true });
