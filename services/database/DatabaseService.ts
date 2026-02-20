import * as SQLite from 'expo-sqlite';
import { createTablesSQL } from './schema';
import type { Message, Conversation } from '@/types/chat';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async initialize(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync('localai.db');
      await this.db.execAsync(createTablesSQL);
      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  async createConversation(title: string = 'New Chat'): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.runAsync(
      'INSERT INTO conversations (title) VALUES (?)',
      title
    );
    return result.lastInsertRowId;
  }

  async getConversations(): Promise<Conversation[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getAllAsync<Conversation>(
      'SELECT * FROM conversations ORDER BY updated_at DESC'
    );
    return result;
  }

  async saveMessage(message: Omit<Message, 'id' | 'createdAt'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.runAsync(
      'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)',
      message.conversationId,
      message.role,
      message.content
    );

    // Update conversation's updated_at timestamp
    await this.db.runAsync(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      message.conversationId
    );

    return result.lastInsertRowId;
  }

  async getMessages(conversationId: number): Promise<Message[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getAllAsync<Message>(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      conversationId
    );
    return result;
  }

  async deleteConversation(conversationId: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync(
      'DELETE FROM conversations WHERE id = ?',
      conversationId
    );
  }

  async clearAllData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.execAsync(`
      DELETE FROM messages;
      DELETE FROM conversations;
    `);
  }
}

export const databaseService = new DatabaseService();
