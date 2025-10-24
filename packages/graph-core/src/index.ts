/**
 * @topolop/graph-core - Database-agnostic graph storage abstraction layer
 *
 * This package provides a unified interface for working with graph databases,
 * currently supporting Neo4j and SQLite backends.
 *
 * @example
 * ```typescript
 * import { createGraphDatabase } from '@topolop/graph-core';
 *
 * const db = createGraphDatabase();
 * await db.connect({
 *   backend: 'neo4j',
 *   uri: 'neo4j://localhost:7687',
 *   username: 'neo4j',
 *   password: 'password'
 * });
 *
 * const session = db.session();
 * const node = await session.createNode('User', { name: 'Alice' });
 * await session.commit();
 * await session.close();
 * ```
 */

// ========================================
// Interfaces
// ========================================
export type { IGraphDatabase, IndexDefinition } from './interfaces/IGraphDatabase';
export type { IGraphSession } from './interfaces/IGraphSession';

// ========================================
// Types
// ========================================
export type {
  DatabaseBackend,
  DatabaseConfig,
  DatabaseInfo,
  GraphNode,
  GraphRelationship,
  NodeReference,
  PathSegment,
  GraphPath,
  QueryResult,
} from './interfaces/types';

// ========================================
// Errors
// ========================================
export {
  GraphDatabaseError,
  ConnectionError,
  QueryError,
  ValidationError,
  NotFoundError,
  TransactionError,
  ConfigurationError,
  BackendError,
} from './errors';

// ========================================
// Utilities
// ========================================
export {
  serializeProperties,
  deserializeProperties,
  isPrimitive,
  validateProperties,
} from './utils/serialization';

// ========================================
// Factory Functions
// ========================================
export { createGraphDatabase } from './backends/factory';
