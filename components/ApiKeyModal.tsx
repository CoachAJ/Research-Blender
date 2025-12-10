import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Eye, EyeOff, Check, AlertCircle, User, Globe } from 'lucide-react';
import * as GeminiService from '../services/geminiService';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySet: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onKeySet }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  
  // User profile fields
  const [userName, setUserName] = useState('');
  const [userWebsite, setUserWebsite] = useState('');

  useEffect(() => {
    if (isOpen) {
      const existingKey = GeminiService.getApiKey();
      if (existingKey) {
        setApiKey(existingKey);
      }
      
      // Load existing profile
      const profile = GeminiService.getUserProfile();
      if (profile) {
        setUserName(profile.name || '');
        setUserWebsite(profile.website || '');
      }
      
      setTestResult(null);
      setErrorMessage('');
    }
  }, [isOpen]);

  const handleTestKey = async () => {
    if (!apiKey.trim()) return;
    
    setIsTesting(true);
    setTestResult(null);
    setErrorMessage('');
    
    try {
      // Temporarily set the key to test it
      GeminiService.setApiKey(apiKey.trim());
      
      // Try a simple API call
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
      
      await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Say "API key is valid" in exactly 4 words.'
      });
      
      setTestResult('success');
    } catch (e: any) {
      setTestResult('error');
      if (e.message?.includes('API_KEY_INVALID') || e.message?.includes('API key not valid')) {
        setErrorMessage('Invalid API key. Please check and try again.');
      } else if (e.message?.includes('quota')) {
        setErrorMessage('API quota exceeded. Try again later or use a different key.');
      } else {
        setErrorMessage(e.message || 'Failed to validate API key.');
      }
      // Clear the invalid key
      GeminiService.clearApiKey();
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    if (testResult === 'success') {
      GeminiService.setApiKey(apiKey.trim());
      
      // Save user profile
      GeminiService.setUserProfile({
        name: userName.trim(),
        website: userWebsite.trim()
      });
      
      onKeySet();
      onClose();
    }
  };

  const handleClear = () => {
    GeminiService.clearApiKey();
    setApiKey('');
    setTestResult(null);
    setErrorMessage('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-500 to-accent-500 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Key size={20} />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg">Settings</h2>
                <p className="text-white/80 text-sm">API key & profile configuration</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-sm text-blue-800">
              Research Blender requires a Google Gemini API key to function. 
              Your key is stored locally in your browser and never sent to our servers.
            </p>
          </div>
          
          {/* API Key Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Gemini API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder="AIza..."
                className="w-full px-4 py-3 pr-20 rounded-xl border border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 text-sm transition-all bg-slate-50"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          
          {/* Test Result */}
          {testResult === 'success' && (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-3 rounded-xl">
              <Check size={18} />
              <span className="text-sm font-medium">API key is valid!</span>
            </div>
          )}
          
          {testResult === 'error' && (
            <div className="flex items-start gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-xl">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span className="text-sm">{errorMessage}</span>
            </div>
          )}
          
          {/* Get API Key Link */}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 transition-colors"
          >
            <ExternalLink size={14} />
            Get a free API key from Google AI Studio
          </a>
          
          {/* Divider */}
          <div className="border-t border-slate-200 pt-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <User size={16} className="text-brand-500" />
              Your Profile (Optional)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Add your name and website to display attribution on generated articles.
            </p>
            
            {/* Name Input */}
            <div className="space-y-2 mb-3">
              <label className="text-sm font-medium text-slate-700">Your Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g., Aj"
                  className="w-full px-4 py-3 pl-10 rounded-xl border border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 text-sm transition-all bg-slate-50"
                />
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
            
            {/* Website Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Your Website</label>
              <div className="relative">
                <input
                  type="text"
                  value={userWebsite}
                  onChange={(e) => setUserWebsite(e.target.value)}
                  placeholder="e.g., ajhealthcoach.com"
                  className="w-full px-4 py-3 pl-10 rounded-xl border border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 text-sm transition-all bg-slate-50"
                />
                <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
            
            {/* Preview */}
            {userName && (
              <div className="mt-4 bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Preview:</p>
                <p className="text-sm text-slate-700 font-medium">
                  Info synthesized by <span className="text-brand-600">{userName}</span>
                  {userWebsite && (
                    <span className="text-slate-500"> - {userWebsite}</span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={handleClear}
            className="text-sm text-slate-500 hover:text-red-500 transition-colors"
          >
            Clear Key
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestKey}
              disabled={!apiKey.trim() || isTesting}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTesting ? 'Testing...' : 'Test Key'}
            </button>
            
            <button
              onClick={handleSave}
              disabled={testResult !== 'success'}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-brand-500 hover:bg-brand-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
