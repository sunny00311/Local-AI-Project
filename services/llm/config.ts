import type { ModelConfig } from '@/types/llm';

export const QWEN_MODEL_CONFIG: ModelConfig = {
  id: 'qwen2.5-0.5b-q4',
  name: 'Qwen2.5 0.5B Q4',
  // For bundled model, URL will be set to local file path after asset loading
  url: 'file://assets/models/qwen2.5-0.5b-instruct-q4_0.gguf',
  size: 350 * 1024 * 1024, // 350MB
  contextLength: 1024,
};

export const DEFAULT_GENERATION_OPTIONS = {
  maxTokens: 256,
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
  stopSequences: ['<|im_end|>'],
};
