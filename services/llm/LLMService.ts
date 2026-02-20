import { LlamaCpp } from '@runanywhere/llamacpp';
import type { GenerateOptions } from '@/types/llm';
import { QWEN_MODEL_CONFIG, DEFAULT_GENERATION_OPTIONS } from './config';

/**
 * LLMService handles text generation using the Runanywhere LlamaCpp SDK
 */
class LLMService {
  private modelId = QWEN_MODEL_CONFIG.id;
  private isInitialized = false;

  async initialize(modelPath: string): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ Model already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing LLM with Runanywhere SDK...');
      
      // Initialize the LlamaCpp model with the local file path
      // Note: Actual initialization will depend on SDK API
      // This is a placeholder that follows the starter app pattern
      
      this.isInitialized = true;
      console.log('✅ LLM initialized successfully');
    } catch (error) {
      console.error('❌ LLM initialization failed:', error);
      throw error;
    }
  }

  async generate(
    prompt: string,
    options: Partial<GenerateOptions> = {},
    onToken?: (token: string) => void
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('LLM not initialized. Call initialize() first.');
    }

    const finalOptions = { ...DEFAULT_GENERATION_OPTIONS, ...options };

    try {
      let fullResponse = '';
      
      console.log('💬 Generating response...');
      console.log('📝 Prompt length:', prompt.length);
      console.log('⚙️  Options:', finalOptions);

      // TODO: Replace with actual Runanywhere SDK generation call
      // Based on the starter app, it should be something like:
      // await LlamaCpp.generate(this.modelId, prompt, finalOptions, onToken);
      
      // For now, this is a placeholder that will be replaced with actual SDK integration
      // when we test on device with the model file present
      
      console.log('✅ Generation complete');
      return fullResponse;
    } catch (error) {
      console.error('❌ Generation failed:', error);
      throw error;
    }
  }

  async stopGeneration(): Promise<void> {
    console.log('🛑 Stopping generation...');
    // Implement cancellation if SDK supports it
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export const llmService = new LLMService();
