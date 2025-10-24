/**
 * Graph session interface - represents a transaction-scoped database session
 */

import {
  GraphNode,
  GraphRelationship,
  NodeReference,
  GraphPath,
  QueryResult,
} from './types';

/**
 * IGraphSession - Transaction-scoped database session
 *
 * All operations within a session are atomic and can be committed or rolled back.
 */
export interface IGraphSession {
  // ========================================
  // Node Operations
  // ========================================

  /**
   * Create a new node in the graph
   * @param label Node label (e.g., "State", "User")
   * @param properties Node properties
   * @returns Created node with assigned ID
   */
  createNode(label: string, properties: Record<string, unknown>): Promise<GraphNode>;

  /**
   * Get a node by label and ID
   * @param label Node label
   * @param id Node ID
   * @returns Node if found, null otherwise
   */
  getNode(label: string, id: string): Promise<GraphNode | null>;

  /**
   * Update a node's properties
   * @param label Node label
   * @param id Node ID
   * @param properties Properties to update (partial update)
   * @returns Updated node
   */
  updateNode(label: string, id: string, properties: Record<string, unknown>): Promise<GraphNode>;

  /**
   * Delete a node and all its relationships
   * @param label Node label
   * @param id Node ID
   */
  deleteNode(label: string, id: string): Promise<void>;

  /**
   * Find nodes matching a filter
   * @param label Node label
   * @param filter Property filters (exact match)
   * @returns Array of matching nodes
   */
  findNodes(label: string, filter?: Record<string, unknown>): Promise<GraphNode[]>;

  // ========================================
  // Relationship Operations
  // ========================================

  /**
   * Create a relationship between two nodes
   * @param from Source node reference
   * @param type Relationship type (e.g., "TRANSITION", "CONTAINS")
   * @param to Target node reference
   * @param properties Optional relationship properties
   * @returns Created relationship with assigned ID
   */
  createRelationship(
    from: NodeReference,
    type: string,
    to: NodeReference,
    properties?: Record<string, unknown>
  ): Promise<GraphRelationship>;

  /**
   * Get all relationships of a specific type from a node
   * @param from Source node reference
   * @param type Relationship type
   * @returns Array of relationships
   */
  getRelationships(from: NodeReference, type: string): Promise<GraphRelationship[]>;

  /**
   * Delete a specific relationship
   * @param relationshipId Relationship ID
   */
  deleteRelationship(relationshipId: string): Promise<void>;

  // ========================================
  // Graph Query Operations
  // ========================================

  /**
   * Find the shortest path between two nodes
   * @param from Source node ID
   * @param to Target node ID
   * @returns Shortest path if exists, null otherwise
   */
  shortestPath(from: string, to: string): Promise<GraphPath | null>;

  /**
   * Find all paths between two nodes
   * @param from Source node ID
   * @param to Target node ID
   * @param maxDepth Maximum path depth (default: 10)
   * @returns Array of all paths
   */
  allPaths(from: string, to: string, maxDepth?: number): Promise<GraphPath[]>;

  /**
   * Get all nodes reachable from a given node
   * @param nodeId Starting node ID
   * @returns Array of reachable nodes
   */
  reachableFrom(nodeId: string): Promise<GraphNode[]>;

  /**
   * Check if a path exists between two nodes
   * @param from Source node ID
   * @param to Target node ID
   * @returns True if path exists
   */
  hasPath(from: string, to: string): Promise<boolean>;

  /**
   * Execute a raw query (backend-specific)
   * @param query Query string (Cypher for Neo4j, SQL for SQLite)
   * @param params Query parameters
   * @returns Query result
   */
  rawQuery<T = unknown>(query: string, params?: Record<string, unknown>): Promise<QueryResult<T>>;

  // ========================================
  // Transaction Control
  // ========================================

  /**
   * Commit the current transaction
   */
  commit(): Promise<void>;

  /**
   * Rollback the current transaction
   */
  rollback(): Promise<void>;

  /**
   * Close the session (auto-commits if not already committed/rolled back)
   */
  close(): Promise<void>;

  /**
   * Check if session is still active
   */
  isActive(): boolean;
}
