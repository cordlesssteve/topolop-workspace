/**
 * Neo4j implementation of IGraphSession
 */

import neo4j, { Session, Transaction, Result } from 'neo4j-driver';
import { IGraphSession } from '../../interfaces/IGraphSession';
import {
  GraphNode,
  GraphRelationship,
  NodeReference,
  GraphPath,
  QueryResult,
  PathSegment,
} from '../../interfaces/types';
import {
  QueryError,
  ValidationError,
  NotFoundError,
  TransactionError,
} from '../../errors';
import {
  serializeProperties,
  deserializeProperties,
  validateProperties,
} from '../../utils/serialization';

export class Neo4jSession implements IGraphSession {
  private transaction: Transaction | null = null;
  private active = true;

  constructor(private readonly session: Session) {
    this.transaction = this.session.beginTransaction();
  }

  // ========================================
  // Node Operations
  // ========================================

  async createNode(label: string, properties: Record<string, unknown>): Promise<GraphNode> {
    this.ensureActive();
    validateProperties(properties);

    const serialized = serializeProperties(properties);

    const query = `
      CREATE (n:${label})
      SET n = $properties
      RETURN n
    `;

    try {
      const result = await this.run(query, { properties: serialized });
      const record = result.records[0];

      if (!record) {
        throw new QueryError('Failed to create node', query);
      }

      const node = record.get('n');
      return this.convertNode(label, node);
    } catch (error) {
      throw new QueryError(`Failed to create node: ${(error as Error).message}`, query, { properties: serialized }, error as Error);
    }
  }

  async getNode(label: string, id: string): Promise<GraphNode | null> {
    this.ensureActive();

    const query = `
      MATCH (n:${label} {id: $id})
      RETURN n
    `;

    try {
      const result = await this.run(query, { id });
      const record = result.records[0];

      if (!record) {
        return null;
      }

      const node = record.get('n');
      return this.convertNode(label, node);
    } catch (error) {
      throw new QueryError(`Failed to get node: ${(error as Error).message}`, query, { id }, error as Error);
    }
  }

  async updateNode(label: string, id: string, properties: Record<string, unknown>): Promise<GraphNode> {
    this.ensureActive();
    validateProperties(properties);

    const serialized = serializeProperties(properties);

    const query = `
      MATCH (n:${label} {id: $id})
      SET n += $properties
      RETURN n
    `;

    try {
      const result = await this.run(query, { id, properties: serialized });
      const record = result.records[0];

      if (!record) {
        throw new NotFoundError(`Node not found`, label, id);
      }

      const node = record.get('n');
      return this.convertNode(label, node);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new QueryError(`Failed to update node: ${(error as Error).message}`, query, { id, properties: serialized }, error as Error);
    }
  }

  async deleteNode(label: string, id: string): Promise<void> {
    this.ensureActive();

    const query = `
      MATCH (n:${label} {id: $id})
      DETACH DELETE n
    `;

    try {
      await this.run(query, { id });
    } catch (error) {
      throw new QueryError(`Failed to delete node: ${(error as Error).message}`, query, { id }, error as Error);
    }
  }

  async findNodes(label: string, filter?: Record<string, unknown>): Promise<GraphNode[]> {
    this.ensureActive();

    let query = `MATCH (n:${label})`;
    const params: Record<string, unknown> = {};

    if (filter && Object.keys(filter).length > 0) {
      validateProperties(filter);
      const serialized = serializeProperties(filter);

      const whereClauses = Object.keys(serialized).map((key, idx) => {
        params[`filter_${idx}`] = serialized[key];
        return `n.${key} = $filter_${idx}`;
      });

      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ` RETURN n`;

    try {
      const result = await this.run(query, params);
      return result.records.map((record) => {
        const node = record.get('n');
        return this.convertNode(label, node);
      });
    } catch (error) {
      throw new QueryError(`Failed to find nodes: ${(error as Error).message}`, query, params, error as Error);
    }
  }

  // ========================================
  // Relationship Operations
  // ========================================

  async createRelationship(
    from: NodeReference,
    type: string,
    to: NodeReference,
    properties?: Record<string, unknown>
  ): Promise<GraphRelationship> {
    this.ensureActive();

    if (properties) {
      validateProperties(properties);
    }

    const serialized = properties ? serializeProperties(properties) : {};

    const query = `
      MATCH (from:${from.label} {id: $fromId})
      MATCH (to:${to.label} {id: $toId})
      CREATE (from)-[r:${type}]->(to)
      SET r = $properties
      RETURN r, id(r) as relId
    `;

    try {
      const result = await this.run(query, {
        fromId: from.id,
        toId: to.id,
        properties: serialized,
      });

      const record = result.records[0];
      if (!record) {
        throw new QueryError('Failed to create relationship', query);
      }

      const rel = record.get('r');
      const relId = record.get('relId');

      return this.convertRelationship(type, from.id, to.id, relId, rel);
    } catch (error) {
      throw new QueryError(
        `Failed to create relationship: ${(error as Error).message}`,
        query,
        { fromId: from.id, toId: to.id, properties: serialized },
        error as Error
      );
    }
  }

  async getRelationships(from: NodeReference, type: string): Promise<GraphRelationship[]> {
    this.ensureActive();

    const query = `
      MATCH (from:${from.label} {id: $fromId})-[r:${type}]->(to)
      RETURN r, id(r) as relId, id(from) as fromId, id(to) as toId
    `;

    try {
      const result = await this.run(query, { fromId: from.id });
      return result.records.map((record) => {
        const rel = record.get('r');
        const relId = record.get('relId');
        const fromId = record.get('fromId');
        const toId = record.get('toId');

        return this.convertRelationship(type, fromId.toString(), toId.toString(), relId, rel);
      });
    } catch (error) {
      throw new QueryError(
        `Failed to get relationships: ${(error as Error).message}`,
        query,
        { fromId: from.id },
        error as Error
      );
    }
  }

  async deleteRelationship(relationshipId: string): Promise<void> {
    this.ensureActive();

    const query = `
      MATCH ()-[r]->()
      WHERE id(r) = $relId
      DELETE r
    `;

    try {
      await this.run(query, { relId: parseInt(relationshipId, 10) });
    } catch (error) {
      throw new QueryError(
        `Failed to delete relationship: ${(error as Error).message}`,
        query,
        { relId: relationshipId },
        error as Error
      );
    }
  }

  // ========================================
  // Graph Query Operations
  // ========================================

  async shortestPath(from: string, to: string): Promise<GraphPath | null> {
    this.ensureActive();

    const query = `
      MATCH path = shortestPath((from {id: $fromId})-[*]-(to {id: $toId}))
      RETURN path
    `;

    try {
      const result = await this.run(query, { fromId: from, toId: to });
      const record = result.records[0];

      if (!record) {
        return null;
      }

      const path = record.get('path');
      return this.convertPath(path);
    } catch (error) {
      throw new QueryError(
        `Failed to find shortest path: ${(error as Error).message}`,
        query,
        { fromId: from, toId: to },
        error as Error
      );
    }
  }

  async allPaths(from: string, to: string, maxDepth = 10): Promise<GraphPath[]> {
    this.ensureActive();

    const query = `
      MATCH path = (from {id: $fromId})-[*1..${maxDepth}]-(to {id: $toId})
      RETURN path
      LIMIT 100
    `;

    try {
      const result = await this.run(query, { fromId: from, toId: to });
      return result.records.map((record) => {
        const path = record.get('path');
        return this.convertPath(path);
      });
    } catch (error) {
      throw new QueryError(
        `Failed to find all paths: ${(error as Error).message}`,
        query,
        { fromId: from, toId: to },
        error as Error
      );
    }
  }

  async reachableFrom(nodeId: string): Promise<GraphNode[]> {
    this.ensureActive();

    const query = `
      MATCH (start {id: $nodeId})-[*]->(reachable)
      RETURN DISTINCT reachable, labels(reachable) as labels
    `;

    try {
      const result = await this.run(query, { nodeId });
      return result.records.map((record) => {
        const node = record.get('reachable');
        const labels = record.get('labels') as string[];
        const label = labels[0] || 'Node';
        return this.convertNode(label, node);
      });
    } catch (error) {
      throw new QueryError(
        `Failed to find reachable nodes: ${(error as Error).message}`,
        query,
        { nodeId },
        error as Error
      );
    }
  }

  async hasPath(from: string, to: string): Promise<boolean> {
    this.ensureActive();

    const query = `
      MATCH (from {id: $fromId})
      MATCH (to {id: $toId})
      RETURN EXISTS((from)-[*]->(to)) as pathExists
    `;

    try {
      const result = await this.run(query, { fromId: from, toId: to });
      const record = result.records[0];
      return record ? record.get('pathExists') : false;
    } catch (error) {
      throw new QueryError(
        `Failed to check path existence: ${(error as Error).message}`,
        query,
        { fromId: from, toId: to },
        error as Error
      );
    }
  }

  async rawQuery<T = unknown>(query: string, params?: Record<string, unknown>): Promise<QueryResult<T>> {
    this.ensureActive();

    try {
      const result = await this.run(query, params || {});
      return {
        records: result.records.map((record) => record.toObject() as T),
        summary: {
          queryType: result.summary.queryType,
          counters: result.summary.counters as unknown as Record<string, number>,
        },
      };
    } catch (error) {
      throw new QueryError(
        `Raw query failed: ${(error as Error).message}`,
        query,
        params,
        error as Error
      );
    }
  }

  // ========================================
  // Transaction Control
  // ========================================

  async commit(): Promise<void> {
    this.ensureActive();

    if (!this.transaction) {
      throw new TransactionError('No active transaction');
    }

    try {
      await this.transaction.commit();
      this.active = false;
    } catch (error) {
      throw new TransactionError(`Failed to commit transaction: ${(error as Error).message}`, error as Error);
    }
  }

  async rollback(): Promise<void> {
    this.ensureActive();

    if (!this.transaction) {
      throw new TransactionError('No active transaction');
    }

    try {
      await this.transaction.rollback();
      this.active = false;
    } catch (error) {
      throw new TransactionError(`Failed to rollback transaction: ${(error as Error).message}`, error as Error);
    }
  }

  async close(): Promise<void> {
    if (!this.active) {
      return;
    }

    // Auto-commit if not already committed/rolled back
    if (this.transaction) {
      try {
        await this.transaction.commit();
      } catch (error) {
        // Ignore commit errors on close
      }
    }

    this.active = false;
    await this.session.close();
  }

  isActive(): boolean {
    return this.active;
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  private ensureActive(): void {
    if (!this.active) {
      throw new TransactionError('Session is not active');
    }
  }

  private async run(query: string, params: Record<string, unknown>): Promise<Result> {
    if (!this.transaction) {
      throw new TransactionError('No active transaction');
    }
    return this.transaction.run(query, params);
  }

  private convertNode(label: string, node: any): GraphNode {
    const props = node.properties || {};
    const deserialized = deserializeProperties(props);

    return {
      id: props.id || node.identity?.toString() || '',
      label,
      properties: deserialized,
    };
  }

  private convertRelationship(
    type: string,
    fromId: string,
    toId: string,
    relId: any,
    rel: any
  ): GraphRelationship {
    const props = rel.properties || {};
    const deserialized = deserializeProperties(props);

    return {
      id: relId.toString(),
      type,
      from: fromId,
      to: toId,
      properties: deserialized,
    };
  }

  private convertPath(path: any): GraphPath {
    const segments: PathSegment[] = [];
    const nodes = path.segments || [];

    for (const segment of nodes) {
      const node = segment.start;
      const rel = segment.relationship;
      const labels = node.labels || [];
      const label = labels[0] || 'Node';

      segments.push({
        node: this.convertNode(label, node),
        relationship: rel ? this.convertRelationship(
          rel.type,
          segment.start.identity?.toString() || '',
          segment.end.identity?.toString() || '',
          rel.identity,
          rel
        ) : undefined,
      });
    }

    // Add final node
    if (path.end) {
      const labels = path.end.labels || [];
      const label = labels[0] || 'Node';
      segments.push({
        node: this.convertNode(label, path.end),
      });
    }

    return {
      segments,
      length: path.length || segments.length - 1,
    };
  }
}
