import React from 'react';
import { StyleSheet, View, SafeAreaView } from 'react-native';
import { useLLMContext } from '@/contexts/LLMContext';
import { useLLMChat } from '@/hooks/useLLMChat';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { MessageList } from '@/components/chat/MessageList';
import { InputBar } from '@/components/chat/InputBar';

export default function ChatScreen() {
  const { isReady, isLoading, error, loadingProgress, conversationId } = useLLMContext();

  // Only initialize chat hook when we have a conversation ID and model is ready
  const chat = useLLMChat(conversationId || 0);

  // Show loading screen while model initializes
  if (isLoading || !isReady) {
    return (
      <LoadingScreen 
        progress={loadingProgress}
        message={error || 'Initializing AI model...'}
      />
    );
  }

  // Show error state
  if (error) {
    return (
      <LoadingScreen 
        progress={0}
        message={`Error: ${error}`}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <MessageList
          messages={chat.messages}
          streamingContent={chat.streamingContent}
          isGenerating={chat.isGenerating}
        />
        <InputBar
          onSend={chat.sendMessage}
          disabled={!isReady}
          isGenerating={chat.isGenerating}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  content: {
    flex: 1,
  },
});
