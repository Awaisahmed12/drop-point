import Head from 'next/head';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Privacy Policy - DropPoint</title>
      </Head>
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-4">Privacy Policy</h1>
        <p className="text-gray-700 mb-3">We respect your privacy. This page describes, at a high level, how we process data.</p>
        <ul className="list-disc pl-6 text-gray-700 space-y-2">
          <li>Authentication and basic profile data are handled by Supabase Auth.</li>
          <li>Property and file data are stored in Supabase Postgres/Storage with Row-Level Security.</li>
          <li>We use essential cookies and, with consent, analytics cookies to improve the product.</li>
          <li>You can request data export/deletion by contacting support.</li>
        </ul>
        <p className="text-gray-500 mt-6">This is a starter policy for development. Replace with counsel-reviewed policy before production launch.</p>
      </div>
    </div>
  );
}


