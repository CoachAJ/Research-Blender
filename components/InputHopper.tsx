import React, { useState, useRef } from 'react';
import { ResearchSource, SourceType } from '../types';
import * as GeminiService from '../services/geminiService';
import YouTubeAuth from './YouTubeAuth';
import { 
  Plus, Mic, StopCircle, Upload, Link as LinkIcon, FileText, 
  Youtube, Globe, Image, Video, Trash2, CheckCircle2, Loader2, 
  AlertCircle, ChevronDown, ChevronUp, Sparkles
} from 'lucide-react';

interface InputHopperProps {
  sources: ResearchSource[];
  setSources: React.Dispatch<React.SetStateAction<ResearchSource[]>>;
}

const InputHopper: React.FC<InputHopperProps> = ({ sources, setSources }) => {
  const [activeTab, setActiveTab] = useState<SourceType>(SourceType.URL);
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle YouTube auth state changes
  const handleYouTubeAuthChange = (token: string | null) => {
    setYoutubeConnected(!!token);
  };

  const addSource = (partialSource: Partial<ResearchSource>) => {
    const newSource: ResearchSource = {
      id: Date.now().toString(),
      extractedText: '',
      status: 'pending',
      title: 'New Source',
      originalContent: '',
      type: SourceType.TEXT,
      ...partialSource
    };
    setSources(prev => [...prev, newSource]);
    return newSource;
  };

  const updateSource = (id: string, updates: Partial<ResearchSource>) => {
    setSources(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const isYoutubeUrl = (url: string) => /(?:youtube\.com|youtu\.be)/.test(url);

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    const wordCount = textInput.trim().split(/\s+/).length;
    addSource({
      type: SourceType.TEXT,
      title: `Notes (${wordCount} words)`,
      originalContent: textInput,
      extractedText: textInput,
      status: 'ready',
      metadata: { wordCount }
    });
    setTextInput('');
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    const url = urlInput.trim();
    const isYT = isYoutubeUrl(url);
    
    const source = addSource({
      type: SourceType.URL,
      title: isYT ? 'YouTube Video' : 'Web Article',
      originalContent: url,
      status: 'processing',
      metadata: { url }
    });
    setUrlInput('');

    try {
      const result = await GeminiService.processUrl(url);
      const wordCount = result.text.split(/\s+/).length;
      updateSource(source.id, { 
        extractedText: result.text, 
        status: 'ready',
        thumbnail: result.thumbnail,
        title: isYT ? 'YouTube Video' : 'Web Article',
        metadata: { url, wordCount }
      });
    } catch (e: any) {
      console.error(e);
      updateSource(source.id, { 
        status: 'error',
        errorMessage: e.message || 'Failed to process URL'
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let type = SourceType.TEXT;
    if (file.type.startsWith('image/')) type = SourceType.IMAGE;
    else if (file.type.startsWith('video/')) type = SourceType.VIDEO;
    else return;

    const source = addSource({
      type,
      title: file.name,
      originalContent: file,
      status: 'processing',
      metadata: { fileName: file.name }
    });

    try {
      let extractedText = '';
      if (type === SourceType.IMAGE) {
        extractedText = await GeminiService.analyzeImage(file);
      } else if (type === SourceType.VIDEO) {
        extractedText = await GeminiService.analyzeVideo(file);
      }
      const wordCount = extractedText.split(/\s+/).length;
      updateSource(source.id, { 
        extractedText, 
        status: 'ready',
        metadata: { fileName: file.name, wordCount }
      });
    } catch (e: any) {
      console.error(e);
      updateSource(source.id, { 
        status: 'error',
        errorMessage: e.message || 'Failed to analyze file'
      });
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const source = addSource({
          type: SourceType.AUDIO,
          title: `Voice Recording`,
          originalContent: blob,
          status: 'processing'
        });

        try {
          const extractedText = await GeminiService.transcribeAudio(blob);
          const wordCount = extractedText.split(/\s+/).length;
          updateSource(source.id, { 
            extractedText, 
            status: 'ready',
            metadata: { wordCount }
          });
        } catch (e: any) {
          console.error(e);
          updateSource(source.id, { 
            status: 'error',
            errorMessage: e.message || 'Failed to transcribe audio'
          });
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error("Mic access denied or error", err);
      alert("Microphone access is required.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const removeSource = (id: string) => {
    setSources(prev => prev.filter(s => s.id !== id));
  };

  const getSourceIcon = (source: ResearchSource) => {
    if (source.type === SourceType.URL) {
      return isYoutubeUrl(source.metadata?.url || '') ? Youtube : Globe;
    }
    const icons = {
      [SourceType.TEXT]: FileText,
      [SourceType.IMAGE]: Image,
      [SourceType.VIDEO]: Video,
      [SourceType.AUDIO]: Mic,
    };
    return icons[source.type] || FileText;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-emerald-500';
      case 'processing': return 'bg-amber-500 animate-pulse';
      case 'error': return 'bg-red-500';
      default: return 'bg-slate-400';
    }
  };

  const tabs = [
    { id: SourceType.URL, icon: LinkIcon, label: 'Link', desc: 'YouTube or Web' },
    { id: SourceType.TEXT, icon: FileText, label: 'Text', desc: 'Notes & Ideas' },
    { id: SourceType.VIDEO, icon: Upload, label: 'Media', desc: 'Images & Video' },
    { id: SourceType.AUDIO, icon: Mic, label: 'Voice', desc: 'Record Audio' },
  ];

  return (
    <div className="flex flex-col h-full glass border-r border-white/20 w-full md:w-[420px] shrink-0">
      {/* Header */}
      <div className="p-5 border-b border-slate-200/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-brand-500 rounded-xl blur-md opacity-30"></div>
            <div className="relative w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Plus size={20} />
            </div>
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-slate-800">Source Hopper</h2>
            <p className="text-xs text-slate-500">Add research materials to blend</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="p-4 grid grid-cols-4 gap-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as SourceType)}
            className={`
              flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200
              ${activeTab === tab.id 
                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30 scale-105' 
                : 'bg-white/80 text-slate-600 hover:bg-white hover:shadow-md border border-slate-100'
              }
            `}
          >
            <tab.icon size={20} className="mb-1" />
            <span className="text-[11px] font-semibold">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Input Area */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          {activeTab === SourceType.TEXT && (
            <div className="space-y-3">
              <textarea
                className="w-full p-4 rounded-xl border border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 text-sm h-28 resize-none transition-all bg-slate-50"
                placeholder="Paste your notes, thoughts, or any text content here..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
              <button 
                onClick={handleTextSubmit}
                disabled={!textInput.trim()}
                className="w-full btn-primary text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Add to Hopper
              </button>
            </div>
          )}

          {activeTab === SourceType.URL && (
            <div className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  className="w-full p-4 pl-12 rounded-xl border border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 text-sm transition-all bg-slate-50"
                  placeholder="Paste YouTube or article URL..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  {urlInput && isYoutubeUrl(urlInput) ? (
                    <Youtube size={18} className="text-red-500" />
                  ) : (
                    <Globe size={18} />
                  )}
                </div>
              </div>
              <button 
                onClick={handleUrlSubmit}
                disabled={!urlInput.trim()}
                className="w-full btn-primary text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2"
              >
                <Sparkles size={16} />
                Fetch & Analyze
              </button>
              
              {/* YouTube OAuth Connection */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500">YouTube Connection</span>
                  {youtubeConnected && (
                    <span className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      Connected
                    </span>
                  )}
                </div>
                <YouTubeAuth onAuthChange={handleYouTubeAuthChange} />
                <p className="text-xs text-slate-400 mt-2">
                  {youtubeConnected 
                    ? "Your YouTube account is connected for better transcript access"
                    : "Connect your YouTube account for more reliable transcript fetching"
                  }
                </p>
              </div>
            </div>
          )}

          {activeTab === SourceType.VIDEO && (
            <div 
              className="relative border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-brand-400 hover:bg-brand-50/50 transition-all cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept="video/*,image/*" 
                className="hidden"
                onChange={handleFileUpload}
              />
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:bg-brand-100 transition-colors">
                <Upload size={24} className="text-slate-400 group-hover:text-brand-500" />
              </div>
              <p className="font-medium text-slate-700">Drop files or click to upload</p>
              <p className="text-xs text-slate-400 mt-1">Images and videos • Analyzed by Gemini</p>
            </div>
          )}

          {activeTab === SourceType.AUDIO && (
            <div className="flex flex-col items-center py-4">
              {!isRecording ? (
                <button 
                  onClick={startRecording}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-red-500/30"
                >
                  <Mic size={32} />
                </button>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-red-600 font-semibold text-sm">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    Recording...
                  </div>
                  <button 
                    onClick={stopRecording}
                    className="w-20 h-20 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors shadow-xl shadow-red-500/40 animate-pulse"
                  >
                    <StopCircle size={32} />
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-500 mt-4 text-center">
                {isRecording ? "Tap to stop and transcribe" : "Tap to start recording"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Sources ({sources.length})
          </h3>
          {sources.length > 0 && (
            <span className="text-xs text-slate-400">
              {sources.filter(s => s.status === 'ready').length} ready
            </span>
          )}
        </div>
        
        {sources.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles size={24} className="text-slate-300" />
            </div>
            <p className="font-medium text-slate-500">No sources yet</p>
            <p className="text-xs text-slate-400 mt-1">Add URLs, text, or media to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sources.map(source => {
              const Icon = getSourceIcon(source);
              const isExpanded = expandedSource === source.id;
              const isYT = source.type === SourceType.URL && isYoutubeUrl(source.metadata?.url || '');
              
              return (
                <div 
                  key={source.id}
                  className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="p-3 flex items-center gap-3">
                    {/* Thumbnail or Icon */}
                    {source.thumbnail ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                        <img src={source.thumbnail} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        isYT ? 'bg-red-100 text-red-600' : 'bg-brand-100 text-brand-600'
                      }`}>
                        <Icon size={18} />
                      </div>
                    )}
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`status-dot ${getStatusColor(source.status)}`}></span>
                        <p className="font-medium text-sm text-slate-800 truncate">{source.title}</p>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {source.status === 'processing' && 'Processing...'}
                        {source.status === 'error' && (source.errorMessage || 'Error occurred')}
                        {source.status === 'ready' && source.metadata?.wordCount && `${source.metadata.wordCount} words extracted`}
                        {source.status === 'ready' && !source.metadata?.wordCount && 'Ready'}
                      </p>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {source.status === 'processing' && (
                        <Loader2 size={16} className="text-amber-500 animate-spin" />
                      )}
                      {source.status === 'ready' && (
                        <button
                          onClick={() => setExpandedSource(isExpanded ? null : source.id)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      )}
                      <button
                        onClick={() => removeSource(source.id)}
                        className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Expanded Content */}
                  {isExpanded && source.extractedText && (
                    <div className="px-3 pb-3">
                      <div className="bg-slate-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                        <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                          {source.extractedText.substring(0, 500)}
                          {source.extractedText.length > 500 && '...'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default InputHopper;
