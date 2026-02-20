import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { ThemedView } from '@/components/themed-view';

interface LoadingScreenProps {
  progress?: number;
  message?: string;
}

export function LoadingScreen({ progress = 0, message = 'Loading model...' }: LoadingScreenProps) {
  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#00D9FF" />
        <Text style={styles.title}>LocalAI Chat</Text>
        <Text style={styles.message}>{message}</Text>
        {progress > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(progress)}%</Text>
          </View>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0E1A',
  },
  content: {
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00D9FF',
    marginTop: 20,
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 30,
  },
  progressContainer: {
    width: 250,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#1F2937',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00D9FF',
    borderRadius: 4,
  },
  progressText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 8,
  },
});
