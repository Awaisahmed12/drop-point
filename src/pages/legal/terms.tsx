import Head from 'next/head';

export default function Terms() {
  return (
    <div className="min-h-dvh bg-ground" style={{ paddingTop: 'var(--safe-top)' }}>
      <Head>
        <title>Terms of Service - DropPoint</title>
      </Head>
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="ios-large-title mb-4">Terms of Service</h1>
        <p className="text-ink mb-3">By using DropPoint, you agree to the following basic terms:</p>
        <ul className="list-disc pl-6 text-ink space-y-2">
          <li>Do not upload unlawful or infringing content.</li>
          <li>You retain ownership of your files; you grant us a limited license to store and process them.</li>
          <li>Service is provided as‑is during development; uptime and support are best effort.</li>
          <li>We may update these terms; continued use constitutes acceptance.</li>
        </ul>
        <p className="text-ink-2 mt-6">This is a non‑final draft for development. Replace with counsel‑reviewed terms before production.</p>
      </div>
    </div>
  );
}


