import React, { useEffect, useState } from 'react';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { WebSidebar } from '../components/WebSidebar';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../utils/supabaseClient';
import { getUserUsageBytes, formatBytes } from '../utils/usage';
import { FREE_TIER_MAX_BYTES, FREE_TIER_GB } from '../../constants';
import { withAuth } from '../components/withAuth';

function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [usageBytes, setUsageBytes] = useState(0);
  const [email, setEmail] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
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
      if (!user) {
        return;
      }
      setEmail(user.email ?? null);
      const metaFirst = (user.user_metadata?.first_name as string) || "";
      const metaLast = (user.user_metadata?.last_name as string) || "";
      setFirstName(metaFirst);
      setLastName(metaLast);
      
      // Load profile enrichment data
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
      } catch (error) {
        console.error('Error loading profile:', error);
      }
      
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
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (error) {
          setProfileError('Failed to save profile. Please try again.');
        } else {
          setIsEditingProfile(false);
          setProfileSuccess(true);
          setTimeout(() => setProfileSuccess(false), 3000);
        }
      }
    } catch {
      setProfileError('Failed to save profile. Please try again.');
    } finally {
      setProfileLoading(false);
    }
  };

  const limitGB = FREE_TIER_GB;
  const pct = Math.min(100, Math.round((usageBytes / FREE_TIER_MAX_BYTES) * 100));

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Head>
        <title>Account - DropPoint</title>
      </Head>
      <WebSidebar />
      <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto p-6 pb-20">
        <h1 className="text-3xl font-extrabold mb-6 tracking-tight text-gray-900">Account</h1>
        {loading ? (
          <div className="text-gray-600">Loading...</div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow border p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">Signed in as</div>
                  <div className="text-lg font-semibold text-gray-900">{email}</div>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  {!isEditingName && (
                    <button
                      className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer text-gray-600"
                      onClick={() => setIsEditingName(true)}
                      title="Edit name"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                      </svg>
                    </button>
                  )}
                </div>

                {!isEditingName ? (
                  <div className="text-base font-semibold text-gray-900">
                    {[firstName, lastName].filter(Boolean).join(' ') || <span className="text-gray-500">Add your name</span>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2">
                      <input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-600"
                        placeholder="First name"
                        autoComplete="given-name"
                      />
                      <input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-600"
                        placeholder="Last name"
                        autoComplete="family-name"
                      />
                    </div>
                    {nameError && (
                      <p className="text-sm text-red-600">{nameError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                        disabled={nameSaving}
                        onClick={async () => {
                          setNameSaving(true);
                          setNameError(null);
                          try {
                            const { error } = await supabase.auth.updateUser({ data: { first_name: firstName, last_name: lastName, full_name: [firstName, lastName].filter(Boolean).join(' ') } });
                            if (error) {
                              setNameError('Failed to save name. Please try again.');
                            } else {
                              setIsEditingName(false);
                            }
                          } catch {
                            setNameError('Failed to save name. Please try again.');
                          } finally {
                            setNameSaving(false);
                          }
                        }}
                      >
                        {nameSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                        disabled={nameSaving}
                        onClick={() => { setIsEditingName(false); setNameError(null); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-6">
                <button
                  className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
                  onClick={async () => {
                    try {
                      // Clear lightweight app caches
                      try { sessionStorage.removeItem('droppoint-map-position'); } catch {}
                      try { sessionStorage.removeItem('droppoint-selected-property'); } catch {}
                      try { sessionStorage.removeItem('droppoint-properties-cache'); } catch {}
                      await supabase.auth.signOut();
                    } finally {
                      window.location.href = '/';
                    }
                  }}
                >
                  Log out
                </button>
              </div>
            </div>

            {/* Profile Enrichment Section */}
            <div className="bg-white rounded-2xl shadow border p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-lg font-semibold text-gray-900">Help us know you better</div>
                  <div className="text-sm text-gray-500">Optional - helps us improve DropPoint for you</div>
                </div>
                {profileSuccess && !isEditingProfile && (
                  <span className="text-sm text-green-600 font-medium">Saved</span>
                )}
                {!isEditingProfile && !profileSuccess && (
                  <button
                    className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                    onClick={() => setIsEditingProfile(true)}
                  >
                    {userType || propertyCount || useCase ? 'Edit' : 'Add details'}
                  </button>
                )}
              </div>

              {!isEditingProfile ? (
                <div className="space-y-3">
                  {userType && (
                    <div>
                      <div className="text-sm text-gray-500">I&apos;m a...</div>
                      <div className="text-base font-medium text-gray-900">{userType}</div>
                    </div>
                  )}
                  {propertyCount && (
                    <div>
                      <div className="text-sm text-gray-500">I manage about...</div>
                      <div className="text-base font-medium text-gray-900">{propertyCount}</div>
                    </div>
                  )}
                  {useCase && (
                    <div>
                      <div className="text-sm text-gray-500">I&apos;ll use DropPoint for...</div>
                      <div className="text-base font-medium text-gray-900">{useCase}</div>
                    </div>
                  )}
                  {!userType && !propertyCount && !useCase && (
                    <div className="text-sm text-gray-400 italic">No additional details added yet</div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* User Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">I&apos;m a...</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Real Estate Agent', 'Property Manager', 'Investor', 'Homeowner', 'Developer', 'Admin', 'Other'].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setUserType(type)}
                          className={`p-3 rounded-lg border-2 transition-all text-sm ${
                            userType === type
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Property Count */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">I manage about...</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['1-5 properties', '6-20 properties', '21-100 properties', '100+ properties'].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setPropertyCount(count)}
                          className={`p-3 rounded-lg border-2 transition-all text-sm ${
                            propertyCount === count
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                          }`}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Use Case */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">I&apos;ll use DropPoint for...</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Document storage', 'Client management', 'Property tracking', 'Portfolio organization', 'Team collaboration', 'Personal use'].map((use) => (
                        <button
                          key={use}
                          type="button"
                          onClick={() => setUseCase(use)}
                          className={`p-3 rounded-lg border-2 transition-all text-sm ${
                            useCase === use
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                          }`}
                        >
                          {use}
                        </button>
                      ))}
                    </div>
                  </div>

                  {profileError && (
                    <p className="text-sm text-red-600">{profileError}</p>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => { setIsEditingProfile(false); setProfileError(null); }}
                      disabled={profileLoading}
                      className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={profileLoading}
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
                    >
                      {profileLoading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Admin Section */}
            {userType === 'Admin' && (
              <div className="bg-white rounded-2xl shadow border p-5">
                <div className="text-lg font-semibold text-gray-900 mb-3">Admin Tools</div>
                <div className="space-y-3">
                  <Link 
                    href="/admin"
                    className="block w-full bg-blue-600 text-white py-3 px-4 rounded-lg text-center font-medium hover:bg-blue-700 transition-colors"
                  >
                    Configuration Management
                  </Link>
                  <p className="text-sm text-gray-600">
                    Manage application settings and feature toggles.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow border p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold text-gray-900">Storage</div>
                  <div className="text-sm text-gray-500">Free plan · {limitGB} GB total</div>
                </div>
                <div className="text-sm font-medium text-gray-900">{formatBytes(usageBytes)} of {limitGB} GB</div>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-blue-600'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-3 text-sm text-gray-500">Paid plans coming soon.</div>
            </div>
          </div>
        )}
      </div>
      {/* Mobile bottom nav fixed */}
      <MobileBottomNav />
      </div>
      </div>
  );
}

// Wrap with auth protection - require authentication
export default withAuth(AccountPage, { requireAuth: true });


