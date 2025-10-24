/**
 * Error classes for @topolop/graph-core
 */
/**
 * Base error class for all graph database errors
 */
export declare class GraphDatabaseError extends Error {
    readonly cause?: Error | undefined;
    constructor(message: string, cause?: Error | undefined);
}
/**
 * Connection-related errors
 */
export declare class ConnectionError extends GraphDatabaseError {
    constructor(message: string, cause?: Error);
}
/**
 * Query execution errors
 */
export declare class QueryError extends GraphDatabaseError {
    readonly query?: string | undefined;
    readonly params?: Record<string, unknown> | undefined;
    constructor(message: string, query?: string | undefined, params?: Record<string, unknown> | undefined, cause?: Error);
}
/**
 * Validation errors (invalid input)
 */
export declare class ValidationError extends GraphDatabaseError {
    readonly field?: string | undefined;
    constructor(message: string, field?: string | undefined, cause?: Error);
}
/**
 * Not found errors (resource doesn't exist)
 */
export declare class NotFoundError extends GraphDatabaseError {
    readonly resource?: string | undefined;
    readonly id?: string | undefined;
    constructor(message: string, resource?: string | undefined, id?: string | undefined, cause?: Error);
}
/**
 * Transaction errors
 */
export declare class TransactionError extends GraphDatabaseError {
    constructor(message: string, cause?: Error);
}
/**
 * Configuration errors
 */
export declare class ConfigurationError extends GraphDatabaseError {
    constructor(message: string, cause?: Error);
}
/**
 * Backend-specific errors
 */
export declare class BackendError extends GraphDatabaseError {
    readonly backend: 'neo4j' | 'sqlite';
    constructor(message: string, backend: 'neo4j' | 'sqlite', cause?: Error);
}
//# sourceMappingURL=index.d.ts.map