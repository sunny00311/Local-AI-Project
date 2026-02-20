import React, { createContext, useContext, useEffect, useState } from 'react';
import { modelService } from '@/services/llm/ModelService';
import { llmService } from '@/services/llm/LLMService';
import { databaseService } from '@/services/database/DatabaseService';
import { ModelLoadingState } from '@/types/llm';

interface LLMContextType {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  loadingProgress: number;
  conversationId: number | null;
}

const LLMContext = createContext<LLMContextType | undefined>(undefined);

export function LLMProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ModelLoadingState>(ModelLoadingState.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [conversationId, setConversationId] = useState<number | null>(null);

  useEffect(() => {
    async function initialize() {
      try {
        console.log('🚀 Starting app initialization...');
        
        // Step 1: Initialize database
        setProgress(10);
        await databaseService.initialize();
        console.log('✅ Database ready');
        
        // Step 2: Create or get first conversation
        setProgress(20);
        const conversations = await databaseService.getConversations();
        if (conversations.length === 0) {
          const newConvId = await databaseService.createConversation('My Chat');
          setConversationId(newConvId);
        } else {
          setConversationId(conversations[0].id!);
        }
        console.log('✅ Conversation ready');
        
        // Step 3: Prepare model asset
        setProgress(40);
        setState(ModelLoadingState.LOADING);
        const modelPath = await modelService.prepareModel();
        console.log('✅ Model asset ready');
        
        // Step 4: Initialize LLM
        setProgress(70);
        await llmService.initialize(modelPath);
        console.log('✅ LLM ready');
        
        setProgress(100);
        setState(ModelLoadingState.READY);
        console.log('🎉 App fully initialized!');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to initialize';
        setError(errorMsg);
        setState(ModelLoadingState.ERROR);
        console.error('❌ Initialization failed:', errorMsg);
      }
    }

    initialize();
  }, []);

  const value: LLMContextType = {
    isReady: state === ModelLoadingState.READY,
    isLoading: state === ModelLoadingState.LOADING || state === ModelLoadingState.DOWNLOADING,
    error,
    loadingProgress: progress,
    conversationId,
  };

  return <LLMContext.Provider value={value}>{children}</LLMContext.Provider>;
}

export function useLLMContext() {
  const context = useContext(LLMContext);
  if (!context) {
    throw new Error('useLLMContext must be used within LLMProvider');
  }
  return context;
}
