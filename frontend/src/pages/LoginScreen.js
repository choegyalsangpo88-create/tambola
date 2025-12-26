import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = () => {
    setIsLoading(true);
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #0f172a 0%, #4c1d95 50%, #0f172a 100%)'
      }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-10 w-64 h-64 bg-amber-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-64 h-64 bg-purple-500 rounded-full blur-3xl"></div>
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md px-6">
        <div
          className="glass-card p-8 md:p-10 text-center"
          data-testid="login-card"
        >
          {/* Logo */}
          <div className="mb-8">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl flex items-center justify-center mb-4">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Tambola
            </h1>
            <p className="text-gray-400 text-sm">Win Big, Play Smart</p>
          </div>

          {/* Login Button */}
          <Button
            data-testid="google-login-btn"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full h-14 text-lg font-bold rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg hover:shadow-amber-500/50 transition-all duration-300 hover:scale-105"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Connecting...</span>
              </div>
            ) : (
              'Continue with Google'
            )}
          </Button>

          <p className="mt-6 text-xs text-gray-500">
            By continuing, you agree to our Terms & Conditions
          </p>
        </div>

        {/* Info text */}
        <p className="text-center mt-6 text-gray-400 text-sm">
          Join thousands of players winning daily!
        </p>
      </div>
    </div>
  );
}
