import React, { useState, useEffect } from 'react';
import { ResearchSource, GeneratedArticle } from './types';
import * as GeminiService from './services/geminiService';
import InputHopper from './components/InputHopper';
import ArticleView from './components/ArticleView';
import ApiKeyModal from './components/ApiKeyModal';
import { Sparkles, AlertTriangle, X, Zap, Layers, Settings, Key } from 'lucide-react';

const App: React.FC = () => {
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [article, setArticle] = useState<GeneratedArticle | null>(null);
  const [isBlending, setIsBlending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blendProgress, setBlendProgress] = useState<string>('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  // Check for API key on mount
  useEffect(() => {
    setHasApiKey(GeminiService.hasApiKey());
    // Show modal if no API key is set
    if (!GeminiService.hasApiKey()) {
      setShowApiKeyModal(true);
    }
  }, []);

  const readySources = sources.filter(s => s.status === 'ready');
  const canBlend = readySources.length > 0;

  const handleBlend = async () => {
    if (!canBlend) return;
    
    setIsBlending(true);
    setError(null);
    setArticle(null);
    setBlendProgress('Gathering sources...');

    try {
      // 1. Aggregate Texts
      const aggregatedText = readySources.map((s, index) => `
        --- SOURCE ${index + 1} (${s.type}): ${s.title} ---
        ${s.extractedText}
      `).join('\n\n');

      setBlendProgress('Synthesizing narrative...');

      // 2. Synthesize Narrative
      const rawMarkdown = await GeminiService.synthesizeNarrative(aggregatedText);
      
      // Extract title
      const titleMatch = rawMarkdown.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : "Research Synthesis";
      const content = rawMarkdown.replace(/^#\s+.+$/m, '').trim();

      setBlendProgress('Complete!');

      setArticle({
        title,
        content,
        sourceCount: readySources.length
      });

    } catch (e) {
      console.error(e);
      setError("Failed to blend research. Please check your API key and try again.");
    } finally {
      setIsBlending(false);
      setBlendProgress('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top Bar - Glass Effect */}
      <header className="h-16 glass-dark text-white flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-accent-500 rounded-xl blur-lg opacity-50"></div>
            <div className="relative bg-gradient-to-br from-brand-500 to-accent-500 p-2.5 rounded-xl">
              <Sparkles size={20} className="text-white" />
            </div>
          </div>
          <div>
            <h1 className="font-display font-bold text-xl tracking-tight">Research Blender</h1>
            <p className="text-xs text-slate-400 -mt-0.5">AI-Powered Synthesis</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Source Counter */}
          {sources.length > 0 && (
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full">
              <Layers size={14} className="text-brand-300" />
              <span className="text-sm font-medium">
                {readySources.length} source{readySources.length !== 1 ? 's' : ''} ready
              </span>
            </div>
          )}
          
          {/* Blend Button */}
          <button
            onClick={handleBlend}
            disabled={!canBlend || isBlending || !hasApiKey}
            className={`
              flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-300
              ${canBlend && !isBlending && hasApiKey
                ? 'btn-primary text-white shadow-lg shadow-brand-500/30' 
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'}
            `}
          >
            {isBlending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>{blendProgress || 'Processing...'}</span>
              </>
            ) : (
              <>
                <Zap size={16} />
                <span>Blend Research</span>
              </>
            )}
          </button>
          
          {/* API Key Status / Settings Button */}
          <button
            onClick={() => setShowApiKeyModal(true)}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all
              ${hasApiKey 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30' 
                : 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 animate-pulse'}
            `}
          >
            <Key size={12} />
            <span>{hasApiKey ? 'API Key Set' : 'Add API Key'}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel: Input Hopper */}
        <InputHopper sources={sources} setSources={setSources} />

        {/* Right Panel: Article View */}
        <div className="flex-1 flex flex-col relative">
          {/* Error Toast */}
          {error && (
            <div className="absolute top-4 right-4 z-30 glass bg-red-50 border-red-200 text-red-700 px-4 py-3 rounded-xl shadow-lg max-w-sm flex items-start gap-3 animate-in slide-in-from-top-2">
              <div className="p-1 bg-red-100 rounded-full">
                <AlertTriangle size={16} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Blend Failed</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
              <button 
                onClick={() => setError(null)} 
                className="p-1 hover:bg-red-100 rounded-full transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <ArticleView 
            article={article} 
            isBlending={isBlending} 
            blendProgress={blendProgress}
            sources={sources}
          />
        </div>
      </main>

      {/* API Key Modal */}
      <ApiKeyModal 
        isOpen={showApiKeyModal} 
        onClose={() => setShowApiKeyModal(false)}
        onKeySet={() => setHasApiKey(true)}
      />
    </div>
  );
};

export default App;