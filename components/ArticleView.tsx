import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { GeneratedArticle, ResearchSource, SourceType } from '../types';
import * as GeminiService from '../services/geminiService';
import { UserProfile } from '../services/geminiService';
import { 
  Wand2, Download, Share2, Edit2, Loader2, Sparkles, ImagePlus, 
  Copy, Check, BookOpen, Layers, Clock, FileText, Zap, User, Globe, X
} from 'lucide-react';

interface ArticleViewProps {
  article: GeneratedArticle | null;
  isBlending: boolean;
  blendProgress?: string;
  sources: ResearchSource[];
}

const ArticleView: React.FC<ArticleViewProps> = ({ article, isBlending, blendProgress, sources }) => {
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | undefined>(undefined);
  const [isCopied, setIsCopied] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  useEffect(() => {
    setCurrentImage(article?.imageUrl);
  }, [article]);

  useEffect(() => {
    // Load user profile
    setUserProfile(GeminiService.getUserProfile());
  }, [article]);

  const handleGenerateInitialImage = async () => {
    if (!article?.content) return;
    
    console.log('Starting image generation...');
    setIsGeneratingPrompt(true);
    
    try {
      console.log('Generating prompt...');
      const prompt = await GeminiService.generateImagePrompt(article.content);
      console.log('Prompt generated:', prompt.substring(0, 100));
      
      setImagePrompt(prompt);
      setIsGeneratingPrompt(false);
      setShowPromptEditor(true);
      console.log('Modal should be visible now');
    } catch (e) {
      console.error("Failed to generate prompt", e);
      alert("Failed to generate image prompt. Please try again.");
      setIsGeneratingPrompt(false);
    }
  };

  const handleGenerateFromPrompt = async () => {
    if (!imagePrompt.trim()) return;
    setIsRegeneratingImage(true);
    try {
      // Extract uploaded images from sources to use as reference
      const imageDataUrls: string[] = [];
      for (const source of sources) {
        if (source.type === SourceType.IMAGE && source.originalContent instanceof File) {
          try {
            const reader = new FileReader();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(source.originalContent as File);
            });
            imageDataUrls.push(dataUrl);
          } catch (err) {
            console.warn('Failed to read image source:', err);
          }
        }
      }
      
      console.log(`Generating image with ${imageDataUrls.length} reference image(s)`);
      const newImage = await GeminiService.generateCoverImage(imagePrompt, imageDataUrls.length > 0 ? imageDataUrls : undefined);
      setCurrentImage(newImage);
      setShowPromptEditor(false);
    } catch (e) {
      console.error("Failed to generate image", e);
      alert("Failed to generate image. Please try again.");
    } finally {
      setIsRegeneratingImage(false);
    }
  };

  const handleEditImage = async () => {
    if (!currentImage || !editPrompt.trim()) return;
    
    setIsRegeneratingImage(true);
    try {
      const newImage = await GeminiService.editImage(currentImage, editPrompt);
      setCurrentImage(newImage);
      setIsEditingImage(false);
      setEditPrompt('');
    } catch (e) {
      console.error("Failed to edit image", e);
      alert("Failed to edit image. Try again.");
    } finally {
      setIsRegeneratingImage(false);
    }
  };

  const handleCopy = () => {
    if (article?.content) {
      navigator.clipboard.writeText(`# ${article.title}\n\n${article.content}`);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!article) return;
    const content = `# ${article.title}\n\n${article.content}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${article.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Loading State
  if (isBlending) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="relative mb-8">
          {/* Animated rings */}
          <div className="absolute inset-0 w-32 h-32 border-4 border-brand-200 rounded-full animate-ping opacity-20"></div>
          <div className="absolute inset-2 w-28 h-28 border-4 border-accent-200 rounded-full animate-ping opacity-20 animation-delay-150"></div>
          <div className="relative w-32 h-32 bg-gradient-to-br from-brand-500 to-accent-500 rounded-full flex items-center justify-center shadow-2xl shadow-brand-500/30">
            <Sparkles className="text-white animate-pulse" size={48} />
          </div>
        </div>
        
        <h2 className="font-display text-3xl font-bold text-slate-800 mb-2">Blending Your Research</h2>
        <p className="text-slate-500 text-center max-w-md mb-8">
          AI is synthesizing your sources into a cohesive narrative
        </p>
        
        {/* Progress Steps */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 w-full max-w-sm">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                blendProgress?.includes('Gathering') ? 'bg-brand-500 text-white' : 'bg-brand-100 text-brand-500'
              }`}>
                <Layers size={16} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm text-slate-700">Gathering Sources</p>
                <p className="text-xs text-slate-400">Collecting all research materials</p>
              </div>
              {blendProgress?.includes('Gathering') && (
                <Loader2 size={16} className="text-brand-500 animate-spin" />
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                blendProgress?.includes('Synthesizing') ? 'bg-accent-500 text-white' : 'bg-slate-100 text-slate-400'
              }`}>
                <Zap size={16} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm text-slate-700">Synthesizing Narrative</p>
                <p className="text-xs text-slate-400">Creating unified article</p>
              </div>
              {blendProgress?.includes('Synthesizing') && (
                <Loader2 size={16} className="text-accent-500 animate-spin" />
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 text-slate-400">
                <Check size={16} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm text-slate-700">Finalizing</p>
                <p className="text-xs text-slate-400">Polishing the output</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty State
  if (!article) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-brand-500/20 rounded-3xl blur-2xl"></div>
          <div className="relative w-28 h-28 bg-gradient-to-br from-slate-100 to-slate-200 rounded-3xl flex items-center justify-center">
            <BookOpen size={48} className="text-slate-400" />
          </div>
        </div>
        
        <h2 className="font-display text-2xl font-bold text-slate-700 mb-2">Ready to Create</h2>
        <p className="text-slate-500 text-center max-w-sm mb-8">
          Add sources to the hopper, then click "Blend Research" to generate your synthesized article.
        </p>
        
        {/* Feature hints */}
        <div className="grid grid-cols-2 gap-4 max-w-md">
          {[
            { icon: FileText, label: 'Text Notes', desc: 'Paste raw content' },
            { icon: Layers, label: 'YouTube', desc: 'Auto-transcribe videos' },
            { icon: ImagePlus, label: 'Images', desc: 'AI visual analysis' },
            { icon: Wand2, label: 'Web Articles', desc: 'Extract & summarize' },
          ].map((feature, i) => (
            <div key={i} className="bg-white/80 rounded-xl p-4 border border-slate-100 text-center">
              <feature.icon size={24} className="text-brand-500 mx-auto mb-2" />
              <p className="font-medium text-sm text-slate-700">{feature.label}</p>
              <p className="text-xs text-slate-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Article View
  if (!article) return null;
  
  const wordCount = article.content.split(/\s+/).length;
  const readTime = Math.ceil(wordCount / 200);

  return (
    <div className="flex-1 overflow-y-auto relative">
      <div className="max-w-3xl mx-auto py-10 px-6">
        
        {/* Cover Image Section */}
        <div className="mb-8 group relative rounded-2xl overflow-hidden bg-gradient-to-br from-brand-100 to-accent-100 shadow-lg min-h-[280px]">
          {currentImage ? (
            <>
              <img 
                src={currentImage} 
                alt="Article Cover" 
                className="w-full h-72 md:h-96 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
              <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                <button 
                  onClick={() => setIsEditingImage(!isEditingImage)}
                  className="glass-dark text-white px-4 py-2 rounded-full text-sm flex items-center gap-2 hover:bg-white/20 transition-colors"
                >
                  <Edit2 size={14} /> Edit with AI
                </button>
              </div>
            </>
          ) : (
            <div className="w-full h-72 flex flex-col items-center justify-center text-slate-600 gap-4 p-8">
              <div className="w-20 h-20 bg-white/80 rounded-2xl flex items-center justify-center shadow-lg">
                <ImagePlus size={36} className="text-brand-500" />
              </div>
              <div className="text-center">
                <p className="font-display font-semibold text-lg text-slate-700">Generate Cover Art</p>
                <p className="text-sm text-slate-500 mb-4 max-w-xs">
                  Create a unique AI-generated image based on your article content
                </p>
                <button 
                  onClick={handleGenerateInitialImage}
                  disabled={isRegeneratingImage}
                  className="btn-primary text-white px-6 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 mx-auto disabled:opacity-50"
                >
                  {isRegeneratingImage ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Sparkles size={18} />
                  )}
                  Generate AI Cover
                </button>
              </div>
            </div>
          )}
          
          {/* Image Editor Panel */}
          {(isEditingImage || (isRegeneratingImage && currentImage)) && (
            <div className="absolute inset-x-0 bottom-0 glass p-4 border-t border-white/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent-100 text-accent-600 rounded-xl">
                  <Sparkles size={18} />
                </div>
                <input 
                  type="text" 
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="Describe how to modify the image..."
                  className="flex-1 bg-white/80 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-accent-400 outline-none"
                  disabled={isRegeneratingImage}
                />
                <button 
                  onClick={handleEditImage}
                  disabled={isRegeneratingImage || !editPrompt.trim()}
                  className="bg-accent-500 hover:bg-accent-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {isRegeneratingImage ? <Loader2 size={16} className="animate-spin" /> : 'Apply'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Article Meta */}
        <div className="flex items-center gap-4 mb-6 text-sm text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock size={14} />
            <span>{readTime} min read</span>
          </div>
          <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
          <div className="flex items-center gap-1.5">
            <FileText size={14} />
            <span>{wordCount.toLocaleString()} words</span>
          </div>
          {article.sourceCount && (
            <>
              <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
              <div className="flex items-center gap-1.5">
                <Layers size={14} />
                <span>{article.sourceCount} sources</span>
              </div>
            </>
          )}
        </div>

        {/* Article Body */}
        <article className="prose prose-slate lg:prose-lg max-w-none">
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-8 leading-tight">
            {article.title}
          </h1>
          <ReactMarkdown>{article.content}</ReactMarkdown>
        </article>
        
        {/* User Attribution */}
        {userProfile?.name && (
          <div className="mt-10 bg-gradient-to-r from-brand-50 to-accent-50 rounded-2xl p-6 border border-brand-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-brand-500 to-accent-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {userProfile.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-0.5">Info synthesized by</p>
                <p className="font-display font-bold text-lg text-slate-800">{userProfile.name}</p>
                {userProfile.website && (
                  <a 
                    href={userProfile.website.startsWith('http') ? userProfile.website : `https://${userProfile.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1 mt-0.5"
                  >
                    <Globe size={12} />
                    {userProfile.website}
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Footer Actions */}
        <div className="mt-8 pt-8 border-t border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Sparkles size={14} className="text-brand-500" />
              <span>Generated with Research Blender & Gemini AI</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                {isCopied ? (
                  <>
                    <Check size={16} className="text-emerald-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Copy
                  </>
                )}
              </button>
              
              <button 
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                <Download size={16} />
                Download
              </button>
              
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-brand-500 hover:bg-brand-600 text-white transition-colors">
                <Share2 size={16} />
                Share
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Image Prompt Editor Modal */}
      {showPromptEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !isRegeneratingImage && setShowPromptEditor(false)}
          />
          
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-500 to-accent-500 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-lg">AI Image Prompt</h2>
                    <p className="text-white/80 text-sm">Edit the prompt before generating</p>
                  </div>
                </div>
                <button 
                  onClick={() => !isRegeneratingImage && setShowPromptEditor(false)}
                  disabled={isRegeneratingImage}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
              {isGeneratingPrompt ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 size={32} className="text-brand-500 animate-spin" />
                    <p className="text-sm text-slate-500">Generating image prompt...</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                      Image Generation Prompt
                    </label>
                    <textarea
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      rows={8}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 text-sm transition-all bg-slate-50 resize-none"
                      placeholder="Describe the image you want to generate..."
                    />
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
                    <p className="text-xs text-blue-800">
                      This prompt will be sent to Gemini's image generation model. Edit it to customize the cover art style, composition, or subject matter.
                    </p>
                  </div>
                </>
              )}
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowPromptEditor(false)}
                disabled={isRegeneratingImage}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              
              <button
                onClick={handleGenerateFromPrompt}
                disabled={!imagePrompt.trim() || isRegeneratingImage}
                className="px-6 py-2 rounded-xl text-sm font-medium bg-brand-500 hover:bg-brand-600 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isRegeneratingImage ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Generate Image
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArticleView;