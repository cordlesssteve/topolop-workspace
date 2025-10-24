/**
 * Factory functions for creating graph database instances
 */

import { IGraphDatabase } from '../interfaces/IGraphDatabase';
import { DatabaseBackend } from '../interfaces/types';
import { ConfigurationError } from '../errors';
import { Neo4jDatabase } from './neo4j/Neo4jDatabase';

/**
 * Create a graph database instance
 *
 * @param backend Backend type ('neo4j' or 'sqlite')
 * @returns Database instance
 *
 * @example
 * ```typescript
 * const db = createGraphDatabase('neo4j');
 * await db.connect({
 *   backend: 'neo4j',
 *   uri: 'neo4j://localhost:7687',
 *   username: 'neo4j',
 *   password: 'password'
 * });
 * ```
 */
export function createGraphDatabase(backend?: DatabaseBackend): IGraphDatabase {
  const effectiveBackend = backend || 'neo4j';

  switch (effectiveBackend) {
    case 'neo4j':
      return new Neo4jDatabase();

    case 'sqlite':
      // TODO: Implement SQLiteDatabase
      throw new ConfigurationError('SQLite backend not yet implemented');

    default:
      throw new ConfigurationError(`Unknown backend: ${effectiveBackend}`);
  }
}
