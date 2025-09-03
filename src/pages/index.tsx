import Head from 'next/head';
import UserAuthForm from '../components/UserAuthForm';
import { useMobileViewport } from '../hooks/useMobileViewport';
import { withAuth } from '../components/withAuth';

function LoginPage() {
  const { getMobileStyles, mobileClasses } = useMobileViewport();

  return (
    <>
      <Head>
        <title>Login - DropPoint Real Estate Document Management</title>
        <meta name="description" content="Sign in to DropPoint to access your real estate document management platform. Organize property files with our interactive map-based system." />
        <meta property="og:title" content="Login - DropPoint Real Estate Document Management" />
        <meta property="og:description" content="Sign in to DropPoint to access your real estate document management platform. Organize property files with our interactive map-based system." />
        <meta property="twitter:title" content="Login - DropPoint Real Estate Document Management" />
        <meta property="twitter:description" content="Sign in to DropPoint to access your real estate document management platform. Organize property files with our interactive map-based system." />
      </Head>
      <div className={`min-h-screen flex items-center justify-center bg-gray-50 px-4 ${mobileClasses.fullScreen}`} 
           style={getMobileStyles('page')}>
        <UserAuthForm />
      </div>
    </>
  );
}

// Wrap with auth protection - redirect authenticated users to /map
export default withAuth(LoginPage, { requireAuth: false });
