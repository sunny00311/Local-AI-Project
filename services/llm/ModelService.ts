import { Asset } from 'expo-asset';
import { QWEN_MODEL_CONFIG } from './config';
import { ModelLoadingState } from '@/types/llm';

/**
 * ModelService handles model registration and loading using Runanywhere SDK
 * This is a simplified version - actual SDK integration will be done based on 
 * the starter app pattern when running on device
 */
export class ModelService {
  private static instance: ModelService;
  private modelLoadingState: ModelLoadingState = ModelLoadingState.IDLE;
  private modelLocalUri: string | null = null;

  private constructor() {}

  static getInstance(): ModelService {
    if (!ModelService.instance) {
      ModelService.instance = new ModelService();
    }
    return ModelService.instance;
  }

  async prepareModel(): Promise<string> {
    try {
      this.modelLoadingState = ModelLoadingState.LOADING;
      console.log('📦 Loading model asset...');
      
      // Get the bundled model asset
      // Note: The actual filename should match what you copied to assets/models/
      const modelAsset = Asset.fromModule(
        require('@/assets/models/qwen2.5-0.5b-instruct-q4_0.gguf')
      );

      // Download asset to device file system (if not already cached)
      await modelAsset.downloadAsync();

      if (!modelAsset.localUri) {
        throw new Error('Failed to load model asset');
      }

      this.modelLocalUri = modelAsset.localUri;
      this.modelLoadingState = ModelLoadingState.READY;
      console.log('✅ Model asset ready:', this.modelLocalUri);
      
      return this.modelLocalUri;
    } catch (error) {
      this.modelLoadingState = ModelLoadingState.ERROR;
      console.error('❌ Failed to prepare model:', error);
      throw error;
    }
  }

  getState(): ModelLoadingState {
    return this.modelLoadingState;
  }

  getModelUri(): string | null {
    return this.modelLocalUri;
  }

  getConfig() {
    return QWEN_MODEL_CONFIG;
  }
}

export const modelService = ModelService.getInstance();
