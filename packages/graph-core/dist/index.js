"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGraphDatabase = exports.validateProperties = exports.isPrimitive = exports.deserializeProperties = exports.serializeProperties = exports.BackendError = exports.ConfigurationError = exports.TransactionError = exports.NotFoundError = exports.ValidationError = exports.QueryError = exports.ConnectionError = exports.GraphDatabaseError = void 0;
// ========================================
// Errors
// ========================================
var errors_1 = require("./errors");
Object.defineProperty(exports, "GraphDatabaseError", { enumerable: true, get: function () { return errors_1.GraphDatabaseError; } });
Object.defineProperty(exports, "ConnectionError", { enumerable: true, get: function () { return errors_1.ConnectionError; } });
Object.defineProperty(exports, "QueryError", { enumerable: true, get: function () { return errors_1.QueryError; } });
Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return errors_1.ValidationError; } });
Object.defineProperty(exports, "NotFoundError", { enumerable: true, get: function () { return errors_1.NotFoundError; } });
Object.defineProperty(exports, "TransactionError", { enumerable: true, get: function () { return errors_1.TransactionError; } });
Object.defineProperty(exports, "ConfigurationError", { enumerable: true, get: function () { return errors_1.ConfigurationError; } });
Object.defineProperty(exports, "BackendError", { enumerable: true, get: function () { return errors_1.BackendError; } });
// ========================================
// Utilities
// ========================================
var serialization_1 = require("./utils/serialization");
Object.defineProperty(exports, "serializeProperties", { enumerable: true, get: function () { return serialization_1.serializeProperties; } });
Object.defineProperty(exports, "deserializeProperties", { enumerable: true, get: function () { return serialization_1.deserializeProperties; } });
Object.defineProperty(exports, "isPrimitive", { enumerable: true, get: function () { return serialization_1.isPrimitive; } });
Object.defineProperty(exports, "validateProperties", { enumerable: true, get: function () { return serialization_1.validateProperties; } });
// ========================================
// Factory Functions
// ========================================
var factory_1 = require("./backends/factory");
Object.defineProperty(exports, "createGraphDatabase", { enumerable: true, get: function () { return factory_1.createGraphDatabase; } });
//# sourceMappingURL=index.js.map