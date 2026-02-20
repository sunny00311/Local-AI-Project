export interface ModelConfig {
  id: string;
  name: string;
  url: string;
  size: number;
  contextLength: number;
}

export interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  stopSequences?: string[];
}

export enum ModelLoadingState {
  IDLE = 'idle',
  DOWNLOADING = 'downloading',
  LOADING = 'loading',
  READY = 'ready',
  ERROR = 'error',
}
