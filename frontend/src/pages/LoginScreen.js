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
        background: 'linear-gradient(135deg, #000000 0%, #0a3d2c 50%, #1a1a1a 100%)'
      }}
    >
      {/* Premium glow effect */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500 rounded-full blur-[120px]"></div>
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md px-6">
        <div
          className="glass-card p-8 md:p-10 text-center"
          data-testid="login-card"
        >
          {/* 3D Tambola Balls Logo - Exactly like the image */}
          <div className="mb-6">
            <div className="relative w-full h-32 mx-auto mb-4 flex items-center justify-center gap-6">
              {/* Blue Ball with white circle and number 6 */}
              <div className="relative w-28 h-28">
                {/* 3D Blue Ball */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-300 via-blue-500 to-blue-700 shadow-2xl" style={{
                  boxShadow: '0 25px 70px rgba(59, 130, 246, 0.7), inset 0 -12px 35px rgba(0,0,0,0.5), inset 0 12px 35px rgba(255,255,255,0.4)'
                }}>
                  {/* Top shine effect */}
                  <div className="absolute top-4 left-6 w-12 h-12 bg-white rounded-full opacity-60 blur-2xl"></div>
                  
                  {/* White Circle in center */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-white shadow-inner flex items-center justify-center" style={{
                      boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.2)'
                    }}>
                      {/* Number 6 in black */}
                      <span className="text-4xl font-black text-black" style={{
                        fontFamily: 'JetBrains Mono, monospace'
                      }}>6</span>
                    </div>
                  </div>
                </div>
                {/* Shadow */}
                <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-24 h-6 bg-black opacity-40 rounded-full blur-xl"></div>
              </div>

              {/* Red Ball with white circle and number 7 */}
              <div className="relative w-28 h-28">
                {/* 3D Red Ball */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-300 via-red-500 to-red-700 shadow-2xl" style={{
                  boxShadow: '0 25px 70px rgba(239, 68, 68, 0.7), inset 0 -12px 35px rgba(0,0,0,0.5), inset 0 12px 35px rgba(255,255,255,0.4)'
                }}>
                  {/* Top shine effect */}
                  <div className="absolute top-4 left-6 w-12 h-12 bg-white rounded-full opacity-60 blur-2xl"></div>
                  
                  {/* White Circle in center */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-white shadow-inner flex items-center justify-center" style={{
                      boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.2)'
                    }}>
                      {/* Number 7 in black */}
                      <span className="text-4xl font-black text-black" style={{
                        fontFamily: 'JetBrains Mono, monospace'
                      }}>7</span>
                    </div>
                  </div>
                </div>
                {/* Shadow */}
                <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-24 h-6 bg-black opacity-40 rounded-full blur-xl"></div>
              </div>
            </div>
            
            {/* TAMBOLA Text - Modern Premium Font */}
            <h1 className="text-5xl md:text-6xl font-black mb-3" style={{
              fontFamily: 'Outfit, sans-serif',
              background: 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 50%, #D97706 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '0.05em',
              textShadow: '0 0 30px rgba(251, 191, 36, 0.3)'
            }}>
              TAMBOLA
            </h1>
            
            {/* New Tagline */}
            <p className="text-lg text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 font-semibold tracking-wide" style={{
              fontFamily: 'Dancing Script, cursive',
              fontSize: '1.25rem'
            }}>
              Turn ur free time into fun time
            </p>
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
      
      {/* Add Dancing Script font */}
      <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&display=swap" rel="stylesheet" />
    </div>
  );
}
