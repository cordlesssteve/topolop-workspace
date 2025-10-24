/**
 * Factory functions for creating graph database instances
 */
import { IGraphDatabase } from '../interfaces/IGraphDatabase';
import { DatabaseBackend } from '../interfaces/types';
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
export declare function createGraphDatabase(backend?: DatabaseBackend): IGraphDatabase;
//# sourceMappingURL=factory.d.ts.map