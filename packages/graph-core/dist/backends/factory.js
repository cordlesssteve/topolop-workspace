"use strict";
/**
 * Factory functions for creating graph database instances
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGraphDatabase = createGraphDatabase;
const errors_1 = require("../errors");
const Neo4jDatabase_1 = require("./neo4j/Neo4jDatabase");
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
function createGraphDatabase(backend) {
    const effectiveBackend = backend || 'neo4j';
    switch (effectiveBackend) {
        case 'neo4j':
            return new Neo4jDatabase_1.Neo4jDatabase();
        case 'sqlite':
            // TODO: Implement SQLiteDatabase
            throw new errors_1.ConfigurationError('SQLite backend not yet implemented');
        default:
            throw new errors_1.ConfigurationError(`Unknown backend: ${effectiveBackend}`);
    }
}
//# sourceMappingURL=factory.js.map