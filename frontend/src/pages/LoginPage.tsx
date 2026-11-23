import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { googleLogin } from '../services/api';
import type { User } from '../types';
import toast from 'react-hot-toast';

interface LoginPageProps {
  onLogin: (user: User, token: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) {
      toast.error('Google login failed');
      return;
    }

    try {
      const data = await googleLogin(response.credential);
      onLogin(data.user, data.token);
      toast.success(`Welcome, ${data.user.name}!`);
    } catch {
      toast.error('Authentication failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Logo */}
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Scheduler</h1>
          <p className="text-gray-500 mb-8">
            Schedule and manage your email campaigns at scale with reliable delivery and real-time tracking.
          </p>

          {/* Google Login */}
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error('Google login failed')}
              theme="outline"
              size="large"
              width="300"
            />
          </div>

          <p className="text-xs text-gray-400 mt-6">
            By signing in, you agree to the terms of service.
          </p>
        </div>
      </div>
    </div>
  );
}
