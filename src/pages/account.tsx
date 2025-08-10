import React, { useEffect, useState } from 'react';
import { MobileBottomNav } from '../components/MobileBottomNav';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../utils/supabaseClient';
import { getUserUsageBytes, formatBytes } from '../utils/usage';
import { FREE_TIER_MAX_BYTES, FREE_TIER_GB } from '../../constants';

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [usageBytes, setUsageBytes] = useState(0);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/';
        return;
      }
      setEmail(user.email ?? null);
      const total = await getUserUsageBytes(user.id);
      setUsageBytes(total);
      setLoading(false);
    };
    init();
  }, []);

  const limitGB = FREE_TIER_GB;
  const pct = Math.min(100, Math.round((usageBytes / FREE_TIER_MAX_BYTES) * 100));

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Account - DropPoint</title>
      </Head>
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
                <div className="hidden sm:block">
                  <Link href="/map" className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold">Back to app</Link>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow border p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-lg font-semibold text-gray-900">Storage usage</div>
                <div className="text-sm text-gray-900">{formatBytes(usageBytes)} of {limitGB} GB</div>
              </div>
              <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-4 bg-blue-600" style={{ width: `${pct}%` }}></div>
              </div>
              <div className="mt-2 text-sm text-gray-700">Free plan limit</div>
              <div className="mt-4">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700">Upgrade plan</button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow border p-5">
              <div className="text-lg font-semibold mb-1 text-gray-900">Plan</div>
              <div className="text-gray-900">Free • {limitGB} GB total</div>
              <div className="mt-2 text-sm text-gray-500">Billing coming soon.</div>
            </div>
          </div>
        )}
      </div>
      {/* Mobile bottom nav fixed */}
      <MobileBottomNav />
    </div>
  );
}


