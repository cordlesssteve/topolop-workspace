"use strict";
/**
 * Error classes for @topolop/graph-core
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackendError = exports.ConfigurationError = exports.TransactionError = exports.NotFoundError = exports.ValidationError = exports.QueryError = exports.ConnectionError = exports.GraphDatabaseError = void 0;
/**
 * Base error class for all graph database errors
 */
class GraphDatabaseError extends Error {
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = 'GraphDatabaseError';
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
exports.GraphDatabaseError = GraphDatabaseError;
/**
 * Connection-related errors
 */
class ConnectionError extends GraphDatabaseError {
    constructor(message, cause) {
        super(message, cause);
        this.name = 'ConnectionError';
    }
}
exports.ConnectionError = ConnectionError;
/**
 * Query execution errors
 */
class QueryError extends GraphDatabaseError {
    constructor(message, query, params, cause) {
        super(message, cause);
        this.query = query;
        this.params = params;
        this.name = 'QueryError';
    }
}
exports.QueryError = QueryError;
/**
 * Validation errors (invalid input)
 */
class ValidationError extends GraphDatabaseError {
    constructor(message, field, cause) {
        super(message, cause);
        this.field = field;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
/**
 * Not found errors (resource doesn't exist)
 */
class NotFoundError extends GraphDatabaseError {
    constructor(message, resource, id, cause) {
        super(message, cause);
        this.resource = resource;
        this.id = id;
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
/**
 * Transaction errors
 */
class TransactionError extends GraphDatabaseError {
    constructor(message, cause) {
        super(message, cause);
        this.name = 'TransactionError';
    }
}
exports.TransactionError = TransactionError;
/**
 * Configuration errors
 */
class ConfigurationError extends GraphDatabaseError {
    constructor(message, cause) {
        super(message, cause);
        this.name = 'ConfigurationError';
    }
}
exports.ConfigurationError = ConfigurationError;
/**
 * Backend-specific errors
 */
class BackendError extends GraphDatabaseError {
    constructor(message, backend, cause) {
        super(message, cause);
        this.backend = backend;
        this.name = 'BackendError';
    }
}
exports.BackendError = BackendError;
//# sourceMappingURL=index.js.map