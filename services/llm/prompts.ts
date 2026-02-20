import type { Message } from '@/types/chat';

/**
 * Build Qwen2.5 formatted prompt from message history
 * Format: <|im_start|>role\ncontent\n<|im_end|>
 */
export function buildQwenPrompt(
  messages: Message[],
  systemPrompt: string = 'You are a helpful AI assistant.'
): string {
  let prompt = `<|im_start|>system\n${systemPrompt}\n<|im_end|>\n`;

  for (const msg of messages) {
    prompt += `<|im_start|>${msg.role}\n${msg.content}\n<|im_end|>\n`;
  }

  prompt += `<|im_start|>assistant\n`;
  return prompt;
}
