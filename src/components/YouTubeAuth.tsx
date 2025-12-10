import React, { useState, useEffect } from 'react';

// YouTube OAuth configuration
// @ts-ignore - Vite env types
const YOUTUBE_CLIENT_ID = (import.meta as any).env?.VITE_YOUTUBE_CLIENT_ID || '';
const YOUTUBE_SCOPES = 'https://www.googleapis.com/auth/youtube.readonly';

interface YouTubeAuthProps {
  onAuthChange: (accessToken: string | null) => void;
}

export const YouTubeAuth: React.FC<YouTubeAuthProps> = ({ onAuthChange }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('youtube_access_token');
    const expiry = localStorage.getItem('youtube_token_expiry');
    
    if (token && expiry && Date.now() < parseInt(expiry)) {
      setIsAuthenticated(true);
      onAuthChange(token);
      fetchUserInfo(token);
    }
  }, []);

  const fetchUserInfo = async (token: string) => {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUserEmail(data.email);
      }
    } catch (e) {
      console.error('Failed to fetch user info:', e);
    }
  };

  const handleLogin = () => {
    if (!YOUTUBE_CLIENT_ID) {
      alert('YouTube Client ID not configured. Please add VITE_YOUTUBE_CLIENT_ID to your environment.');
      return;
    }

    setIsLoading(true);

    // Create OAuth URL
    const redirectUri = `${window.location.origin}/auth/youtube/callback`;
    const state = Math.random().toString(36).substring(7);
    localStorage.setItem('youtube_oauth_state', state);

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', YOUTUBE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('scope', YOUTUBE_SCOPES);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('include_granted_scopes', 'true');

    // Open popup for OAuth
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      authUrl.toString(),
      'YouTube Login',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // Listen for OAuth callback
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'youtube_oauth_callback') {
        const { access_token, expires_in, state: returnedState } = event.data;
        
        const savedState = localStorage.getItem('youtube_oauth_state');
        if (returnedState !== savedState) {
          console.error('OAuth state mismatch');
          setIsLoading(false);
          return;
        }

        if (access_token) {
          const expiryTime = Date.now() + (expires_in * 1000);
          localStorage.setItem('youtube_access_token', access_token);
          localStorage.setItem('youtube_token_expiry', expiryTime.toString());
          
          setIsAuthenticated(true);
          onAuthChange(access_token);
          fetchUserInfo(access_token);
        }
        
        setIsLoading(false);
        window.removeEventListener('message', handleMessage);
        popup?.close();
      }
    };

    window.addEventListener('message', handleMessage);

    // Cleanup if popup is closed without completing auth
    const checkPopup = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkPopup);
        setIsLoading(false);
        window.removeEventListener('message', handleMessage);
      }
    }, 500);
  };

  const handleLogout = () => {
    localStorage.removeItem('youtube_access_token');
    localStorage.removeItem('youtube_token_expiry');
    localStorage.removeItem('youtube_oauth_state');
    setIsAuthenticated(false);
    setUserEmail(null);
    onAuthChange(null);
  };

  if (!YOUTUBE_CLIENT_ID) {
    return null; // Don't show auth UI if not configured
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
      {isAuthenticated ? (
        <>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {userEmail || 'Connected'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-red-600 hover:text-red-700 underline"
          >
            Disconnect
          </button>
        </>
      ) : (
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-md transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          )}
          Connect YouTube
        </button>
      )}
    </div>
  );
};

export default YouTubeAuth;
