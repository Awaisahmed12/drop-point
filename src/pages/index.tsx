import Head from 'next/head';
import UserAuthForm from '../components/UserAuthForm';
import { withAuth } from '../components/withAuth';

function LoginPage() {
  return (
    <>
      <Head>
        <title>Sign in - DropPoint</title>
        <meta name="description" content="Sign in to DropPoint to organize property documents on an interactive map." />
        <meta property="og:title" content="Sign in - DropPoint" />
        <meta property="og:description" content="Sign in to DropPoint to organize property documents on an interactive map." />
      </Head>
      <main
        className="min-h-dvh bg-ground flex items-center justify-center px-5"
        style={{ paddingTop: 'calc(var(--safe-top) + 24px)', paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}
      >
        <UserAuthForm />
      </main>
    </>
  );
}

// Signed-in users are sent straight to the map.
export default withAuth(LoginPage, { requireAuth: false });
