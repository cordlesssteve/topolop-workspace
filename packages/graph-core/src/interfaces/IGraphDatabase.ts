/**
 * Graph database interface - main entry point for database operations
 */

import { DatabaseConfig, DatabaseInfo } from './types';
import { IGraphSession } from './IGraphSession';

/**
 * IGraphDatabase - Main database connection and session management
 *
 * This interface abstracts the underlying database implementation,
 * allowing code to work with both Neo4j and SQLite backends.
 */
export interface IGraphDatabase {
  // ========================================
  // Connection Management
  // ========================================

  /**
   * Connect to the database
   * @param config Database configuration
   */
  connect(config: DatabaseConfig): Promise<void>;

  /**
   * Disconnect from the database
   */
  disconnect(): Promise<void>;

  /**
   * Check if database is connected
   */
  isConnected(): boolean;

  /**
   * Ping the database to check connectivity
   * @returns True if database is reachable
   */
  ping(): Promise<boolean>;

  /**
   * Get database information
   * @returns Database info including version and statistics
   */
  getInfo(): Promise<DatabaseInfo>;

  // ========================================
  // Session Management
  // ========================================

  /**
   * Create a new transaction-scoped session
   * @returns New session instance
   */
  session(): IGraphSession;

  // ========================================
  // Database Maintenance
  // ========================================

  /**
   * Clear all data from the database (DESTRUCTIVE)
   */
  clear(): Promise<void>;

  /**
   * Run database migrations/schema updates
   * @param version Target schema version
   */
  migrate(version?: string): Promise<void>;

  /**
   * Create indexes for performance optimization
   * @param definitions Index definitions
   */
  createIndexes(definitions: IndexDefinition[]): Promise<void>;

  /**
   * Export data in a portable format
   * @param format Export format ('json' | 'cypher' | 'graphml')
   * @returns Exported data as string
   */
  export(format: 'json' | 'cypher' | 'graphml'): Promise<string>;

  /**
   * Import data from a portable format
   * @param data Data to import
   * @param format Import format
   */
  import(data: string, format: 'json' | 'cypher' | 'graphml'): Promise<void>;
}

/**
 * Index definition for performance optimization
 */
export interface IndexDefinition {
  label: string;
  properties: string[];
  type?: 'btree' | 'fulltext';
}
