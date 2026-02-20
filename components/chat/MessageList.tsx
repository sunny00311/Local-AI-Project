import React from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { ChatBubble } from './ChatBubble';
import type { Message } from '@/types/chat';

interface MessageListProps {
  messages: Message[];
  streamingContent?: string;
  isGenerating?: boolean;
}

export function MessageList({ messages, streamingContent, isGenerating }: MessageListProps) {
  const flatListRef = React.useRef<FlatList>(null);

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, streamingContent]);

  const renderItem = ({ item }: { item: Message }) => <ChatBubble message={item} />;

  return (
    <View style={styles.container}>
      {messages.length === 0 && !isGenerating ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Start a conversation...</Text>
          <Text style={styles.emptySubtext}>Your AI chat runs entirely on-device</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item.id?.toString() || `msg-${index}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
      
      {/* Show streaming content as temporary assistant message */}
      {isGenerating && streamingContent && (
        <View style={styles.streamingContainer}>
          <ChatBubble 
            message={{
              conversationId: 0,
              role: 'assistant',
              content: streamingContent,
            }}
          />
        </View>
      )}
      
      {/* Show typing indicator when waiting for first token */}
      {isGenerating && !streamingContent && (
        <View style={styles.typingContainer}>
          <Text style={styles.typingText}>● ● ●</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 20,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  streamingContainer: {
    paddingBottom: 8,
  },
  typingContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typingText: {
    color: '#00D9FF',
    fontSize: 24,
    letterSpacing: 4,
  },
});
