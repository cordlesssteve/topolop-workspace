/**
 * Error classes for @topolop/graph-core
 */

/**
 * Base error class for all graph database errors
 */
export class GraphDatabaseError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'GraphDatabaseError';

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Connection-related errors
 */
export class ConnectionError extends GraphDatabaseError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'ConnectionError';
  }
}

/**
 * Query execution errors
 */
export class QueryError extends GraphDatabaseError {
  constructor(
    message: string,
    public readonly query?: string,
    public readonly params?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, cause);
    this.name = 'QueryError';
  }
}

/**
 * Validation errors (invalid input)
 */
export class ValidationError extends GraphDatabaseError {
  constructor(message: string, public readonly field?: string, cause?: Error) {
    super(message, cause);
    this.name = 'ValidationError';
  }
}

/**
 * Not found errors (resource doesn't exist)
 */
export class NotFoundError extends GraphDatabaseError {
  constructor(
    message: string,
    public readonly resource?: string,
    public readonly id?: string,
    cause?: Error
  ) {
    super(message, cause);
    this.name = 'NotFoundError';
  }
}

/**
 * Transaction errors
 */
export class TransactionError extends GraphDatabaseError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'TransactionError';
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends GraphDatabaseError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'ConfigurationError';
  }
}

/**
 * Backend-specific errors
 */
export class BackendError extends GraphDatabaseError {
  constructor(
    message: string,
    public readonly backend: 'neo4j' | 'sqlite',
    cause?: Error
  ) {
    super(message, cause);
    this.name = 'BackendError';
  }
}
