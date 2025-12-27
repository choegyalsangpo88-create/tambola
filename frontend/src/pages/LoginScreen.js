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
          {/* Ultra-Realistic 4K 3D Tambola Ball Logo */}
          <div className="mb-6">
            <div className="relative w-full h-40 mx-auto mb-4 flex items-center justify-center">
              {/* Single Blue Ball with 67 - 4K Quality */}
              <div className="relative w-36 h-36">
                {/* 3D Blue Ball - Ultra Realistic */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-200 via-blue-400 to-blue-800 shadow-2xl" style={{
                  boxShadow: '0 30px 90px rgba(37, 99, 235, 0.8), inset 0 -15px 45px rgba(0,0,0,0.6), inset 0 15px 45px rgba(255,255,255,0.5), 0 0 60px rgba(59, 130, 246, 0.4)'
                }}>
                  {/* Top highlight - creating glass-like shine */}
                  <div className="absolute top-6 left-8 w-16 h-16 bg-gradient-to-br from-white to-transparent rounded-full opacity-70 blur-2xl"></div>
                  
                  {/* Secondary highlight for depth */}
                  <div className="absolute top-3 left-5 w-10 h-10 bg-white rounded-full opacity-50 blur-xl"></div>
                  
                  {/* White Circle Label in center - 4K crisp */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center" style={{
                      boxShadow: 'inset 0 3px 10px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15), inset 0 -2px 6px rgba(0,0,0,0.1)'
                    }}>
                      {/* Number 67 in crisp black */}
                      <span className="text-5xl font-black text-black tracking-tight" style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                      }}>67</span>
                    </div>
                  </div>
                  
                  {/* Bottom shadow gradient for sphere depth */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/30 to-transparent pointer-events-none"></div>
                </div>
                
                {/* Realistic Ground Shadow */}
                <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-32 h-8 bg-black opacity-50 rounded-full blur-2xl"></div>
                
                {/* Ambient glow around ball */}
                <div className="absolute inset-0 rounded-full bg-blue-400 opacity-20 blur-3xl scale-110"></div>
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
