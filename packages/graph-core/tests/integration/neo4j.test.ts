/**
 * Integration tests for Neo4j backend
 *
 * These tests require a running Neo4j instance.
 * Run with: docker-compose up -d
 */

import { createGraphDatabase } from '../../src';
import { IGraphDatabase } from '../../src/interfaces/IGraphDatabase';

describe('Neo4j Integration Tests', () => {
  let db: IGraphDatabase;

  beforeAll(async () => {
    db = createGraphDatabase('neo4j');

    await db.connect({
      backend: 'neo4j',
      uri: process.env.NEO4J_URI || 'neo4j://localhost:7688',
      username: process.env.NEO4J_USER || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'monketree123',
    });

    // Clear database before tests
    await db.clear();
  });

  afterAll(async () => {
    if (db) {
      await db.disconnect();
    }
  });

  describe('Connection', () => {
    it('should connect successfully', async () => {
      const isConnected = db.isConnected();
      expect(isConnected).toBe(true);
    });

    it('should ping successfully', async () => {
      const result = await db.ping();
      expect(result).toBe(true);
    });

    it('should get database info', async () => {
      const info = await db.getInfo();
      expect(info.backend).toBe('neo4j');
      expect(info.connected).toBe(true);
      expect(info.version).toBeDefined();
    });
  });

  describe('Node Operations', () => {
    it('should create a node', async () => {
      const session = db.session();

      const node = await session.createNode('TestUser', {
        id: 'user1',
        name: 'Alice',
        age: 30,
      });

      expect(node.id).toBe('user1');
      expect(node.label).toBe('TestUser');
      expect(node.properties.name).toBe('Alice');
      expect(node.properties.age).toBe(30);

      await session.commit();
      await session.close();
    });

    it('should get a node by ID', async () => {
      const session = db.session();

      const node = await session.getNode('TestUser', 'user1');

      expect(node).not.toBeNull();
      expect(node?.properties.name).toBe('Alice');

      await session.close();
    });

    it('should update a node', async () => {
      const session = db.session();

      const updated = await session.updateNode('TestUser', 'user1', {
        age: 31,
        city: 'New York',
      });

      expect(updated.properties.age).toBe(31);
      expect(updated.properties.city).toBe('New York');
      expect(updated.properties.name).toBe('Alice'); // Should preserve existing properties

      await session.commit();
      await session.close();
    });

    it('should find nodes with filter', async () => {
      const session = db.session();

      // Create another user
      await session.createNode('TestUser', {
        id: 'user2',
        name: 'Bob',
        age: 25,
      });

      await session.commit();
      await session.close();

      // Create new session for queries
      const session2 = db.session();

      // Find users
      const allUsers = await session2.findNodes('TestUser');
      expect(allUsers.length).toBeGreaterThanOrEqual(2);

      // Find specific user
      const alice = await session2.findNodes('TestUser', { name: 'Alice' });
      expect(alice.length).toBe(1);
      expect(alice[0]?.properties.name).toBe('Alice');

      await session2.close();
    });

    it('should delete a node', async () => {
      const session = db.session();

      await session.deleteNode('TestUser', 'user2');
      await session.commit();
      await session.close();

      // Create new session to verify deletion
      const session2 = db.session();
      const deleted = await session2.getNode('TestUser', 'user2');
      expect(deleted).toBeNull();

      await session2.close();
    });
  });

  describe('Relationship Operations', () => {
    beforeEach(async () => {
      const session = db.session();

      await session.createNode('TestUser', { id: 'alice', name: 'Alice' });
      await session.createNode('TestUser', { id: 'bob', name: 'Bob' });

      await session.commit();
      await session.close();
    });

    it('should create a relationship', async () => {
      const session = db.session();

      const rel = await session.createRelationship(
        { label: 'TestUser', id: 'alice' },
        'KNOWS',
        { label: 'TestUser', id: 'bob' },
        { since: '2024-01-01' }
      );

      expect(rel.type).toBe('KNOWS');
      expect(rel.from).toBe('alice');
      expect(rel.to).toBe('bob');
      expect(rel.properties.since).toBe('2024-01-01');

      await session.commit();
      await session.close();
    });

    it('should get relationships', async () => {
      const session = db.session();

      const rels = await session.getRelationships(
        { label: 'TestUser', id: 'alice' },
        'KNOWS'
      );

      expect(rels.length).toBeGreaterThanOrEqual(1);
      expect(rels[0]?.type).toBe('KNOWS');

      await session.close();
    });
  });

  describe('Graph Queries', () => {
    beforeEach(async () => {
      const session = db.session();

      // Create a simple graph: A -> B -> C
      await session.createNode('TestNode', { id: 'A', name: 'Node A' });
      await session.createNode('TestNode', { id: 'B', name: 'Node B' });
      await session.createNode('TestNode', { id: 'C', name: 'Node C' });

      await session.createRelationship(
        { label: 'TestNode', id: 'A' },
        'CONNECTS_TO',
        { label: 'TestNode', id: 'B' }
      );

      await session.createRelationship(
        { label: 'TestNode', id: 'B' },
        'CONNECTS_TO',
        { label: 'TestNode', id: 'C' }
      );

      await session.commit();
      await session.close();
    });

    it('should find shortest path', async () => {
      const session = db.session();

      const path = await session.shortestPath('A', 'C');

      expect(path).not.toBeNull();
      expect(path?.length).toBe(2); // A -> B -> C has length 2

      await session.close();
    });

    it('should check if path exists', async () => {
      const session = db.session();

      const exists = await session.hasPath('A', 'C');
      expect(exists).toBe(true);

      const notExists = await session.hasPath('C', 'A');
      expect(notExists).toBe(false); // No path in reverse direction

      await session.close();
    });

    it('should find reachable nodes', async () => {
      const session = db.session();

      const reachable = await session.reachableFrom('A');

      // Should at least contain B and C
      expect(reachable.length).toBeGreaterThanOrEqual(2);
      const ids = reachable.map((n) => n.properties.id);
      expect(ids).toContain('B');
      expect(ids).toContain('C');

      await session.close();
    });
  });

  describe('Transaction Control', () => {
    it('should rollback on error', async () => {
      const session = db.session();

      await session.createNode('TestRollback', { id: 'rollback1', value: 'test' });

      // Don't commit - rollback instead
      await session.rollback();
      await session.close();

      // Verify node was not created
      const session2 = db.session();
      const node = await session2.getNode('TestRollback', 'rollback1');
      expect(node).toBeNull();

      await session2.close();
    });

    it('should auto-commit on close if not committed', async () => {
      const session = db.session();

      await session.createNode('TestAutoCommit', { id: 'auto1', value: 'test' });

      // Close without explicit commit
      await session.close();

      // Verify node was auto-committed
      const session2 = db.session();
      const node = await session2.getNode('TestAutoCommit', 'auto1');
      expect(node).not.toBeNull();

      await session2.close();
    });
  });

  describe('Property Serialization', () => {
    it('should serialize complex objects', async () => {
      const session = db.session();

      const node = await session.createNode('TestSerialization', {
        id: 'complex1',
        metadata: {
          foo: 'bar',
          nested: { value: 42 },
        },
        tags: ['important', 'test'],
      });

      await session.commit();
      await session.close();

      // Retrieve and verify deserialization
      const session2 = db.session();
      const retrieved = await session2.getNode('TestSerialization', 'complex1');

      expect(retrieved?.properties.metadata).toEqual({
        foo: 'bar',
        nested: { value: 42 },
      });
      expect(retrieved?.properties.tags).toEqual(['important', 'test']);

      await session2.close();
    });
  });
});
