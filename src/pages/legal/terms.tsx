import Head from 'next/head';

export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Terms of Service - DropPoint</title>
      </Head>
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-4">Terms of Service</h1>
        <p className="text-gray-700 mb-3">By using DropPoint, you agree to the following basic terms:</p>
        <ul className="list-disc pl-6 text-gray-700 space-y-2">
          <li>Do not upload unlawful or infringing content.</li>
          <li>You retain ownership of your files; you grant us a limited license to store and process them.</li>
          <li>Service is provided as‑is during development; uptime and support are best effort.</li>
          <li>We may update these terms; continued use constitutes acceptance.</li>
        </ul>
        <p className="text-gray-500 mt-6">This is a non‑final draft for development. Replace with counsel‑reviewed terms before production.</p>
      </div>
    </div>
  );
}


