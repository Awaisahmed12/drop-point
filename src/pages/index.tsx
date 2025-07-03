import UserAuthForm from '../components/UserAuthForm';
import { useMobileViewport } from '../hooks/useMobileViewport';

export default function Home() {
  const { getMobileStyles, mobileClasses } = useMobileViewport();

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gray-50 px-4 ${mobileClasses.fullScreen}`} 
         style={getMobileStyles('page')}>
      <UserAuthForm />
    </div>
  );
}
