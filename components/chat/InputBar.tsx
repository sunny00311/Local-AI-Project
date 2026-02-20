import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InputBarProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isGenerating?: boolean;
}

export function InputBar({ onSend, disabled = false, isGenerating = false }: InputBarProps) {
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (inputText.trim() && !disabled) {
      onSend(inputText.trim());
      setInputText('');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.container}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor="#6B7280"
          multiline
          maxLength={1000}
          editable={!disabled && !isGenerating}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (disabled || isGenerating || !inputText.trim()) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={disabled || isGenerating || !inputText.trim()}
        >
          <Ionicons
            name="send"
            size={24}
            color={(disabled || isGenerating || !inputText.trim()) ? '#6B7280' : '#00D9FF'}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#1F2937',
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  input: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    color: '#FFFFFF',
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
