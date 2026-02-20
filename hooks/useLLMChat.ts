import { useState, useCallback, useEffect } from 'react';
import { llmService } from '@/services/llm/LLMService';
import { databaseService } from '@/services/database/DatabaseService';
import { buildQwenPrompt } from '@/services/llm/prompts';
import type { Message } from '@/types/chat';

export function useLLMChat(conversationId: number) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load chat history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        console.log('📚 Loading chat history...');
        const history = await databaseService.getMessages(conversationId);
        setMessages(history);
        console.log(`✅ Loaded ${history.length} messages`);
      } catch (err) {
        console.error('❌ Failed to load history:', err);
      }
    }
    loadHistory();
  }, [conversationId]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isGenerating) {
        console.log('⚠️  Skipping: empty message or already generating');
        return;
      }

      setError(null);
      console.log('💬 Sending message:', content.substring(0, 50) + '...');
      
      // Add user message to UI
      const userMessage: Omit<Message, 'id' | 'createdAt'> = {
        conversationId,
        role: 'user',
        content: content.trim(),
      };

      const tempUserMsg = { ...userMessage, id: Date.now() } as Message;
      setMessages((prev) => [...prev, tempUserMsg]);
      
      try {
        // Save user message to database
        await databaseService.saveMessage(userMessage);
        console.log('✅ User message saved');

        // Start generation
        setIsGenerating(true);
        setStreamingContent('');

        // Build prompt with full history
        const prompt = buildQwenPrompt([...messages, tempUserMsg]);
        console.log('📝 Prompt built, length:', prompt.length);

        // Generate response with streaming
        let fullResponse = '';
        await llmService.generate(
          prompt,
          {},
          (token) => {
            fullResponse += token;
            setStreamingContent(fullResponse);
          }
        );

        console.log('✅ Generation complete, length:', fullResponse.length);

        // Add assistant message
        const assistantMessage: Omit<Message, 'id' | 'createdAt'> = {
          conversationId,
          role: 'assistant',
          content: fullResponse,
        };

        setMessages((prev) => [...prev, assistantMessage as Message]);
        await databaseService.saveMessage(assistantMessage);
        console.log('✅ Assistant message saved');
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Generation failed';
        setError(errMsg);
        console.error('❌ Failed to generate response:', err);
      } finally {
        setIsGenerating(false);
        setStreamingContent('');
      }
    },
    [conversationId, messages, isGenerating]
  );

  const clearHistory = useCallback(async () => {
    try {
      console.log('🗑️  Clearing conversation history...');
      await databaseService.deleteConversation(conversationId);
      setMessages([]);
      console.log('✅ History cleared');
    } catch (err) {
      console.error('❌ Failed to clear history:', err);
    }
  }, [conversationId]);

  return {
    messages,
    isGenerating,
    streamingContent,
    error,
    sendMessage,
    clearHistory,
  };
}
