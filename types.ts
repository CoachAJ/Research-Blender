export enum SourceType {
  TEXT = 'Text',
  URL = 'URL',
  VIDEO = 'Video',
  IMAGE = 'Image',
  AUDIO = 'Audio'
}

export interface ResearchSource {
  id: string;
  type: SourceType;
  title: string;
  originalContent: string | Blob | File;
  extractedText: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
  errorMessage?: string;
  thumbnail?: string; // For YouTube videos
  metadata?: {
    url?: string;
    fileName?: string;
    duration?: number;
    wordCount?: number;
  };
}

export interface GeneratedArticle {
  title: string;
  content: string;
  imageUrl?: string;
  imagePrompt?: string;
  sourceCount?: number;
  generatedAt?: Date;
}

export interface BlenderState {
  sources: ResearchSource[];
  isBlending: boolean;
  article: GeneratedArticle | null;
  error: string | null;
}
