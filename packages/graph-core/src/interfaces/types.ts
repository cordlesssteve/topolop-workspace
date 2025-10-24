/**
 * Core type definitions for @topolop/graph-core
 */

/**
 * Database backend types
 */
export type DatabaseBackend = 'neo4j' | 'sqlite';

/**
 * Database configuration
 */
export interface DatabaseConfig {
  backend: DatabaseBackend;
  uri?: string;
  username?: string;
  password?: string;
  database?: string;
  filePath?: string; // For SQLite
}

/**
 * Database information
 */
export interface DatabaseInfo {
  backend: DatabaseBackend;
  version: string;
  connected: boolean;
  nodeCount?: number;
  relationshipCount?: number;
}

/**
 * Graph node representation
 */
export interface GraphNode {
  id: string;
  label: string;
  properties: Record<string, unknown>;
}

/**
 * Graph relationship representation
 */
export interface GraphRelationship {
  id: string;
  type: string;
  from: string;
  to: string;
  properties: Record<string, unknown>;
}

/**
 * Node reference for relationship creation
 */
export interface NodeReference {
  label: string;
  id: string;
}

/**
 * Path segment in a graph path
 */
export interface PathSegment {
  node: GraphNode;
  relationship?: GraphRelationship;
}

/**
 * Graph path representation
 */
export interface GraphPath {
  segments: PathSegment[];
  length: number;
}

/**
 * Query result wrapper
 */
export interface QueryResult<T = unknown> {
  records: T[];
  summary?: {
    queryType: string;
    counters?: Record<string, number>;
  };
}
