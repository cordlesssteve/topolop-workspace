/**
 * Neo4j implementation of IGraphDatabase
 */

import neo4j, { Driver, Session as Neo4jSession } from 'neo4j-driver';
import { IGraphDatabase, IndexDefinition } from '../../interfaces/IGraphDatabase';
import { IGraphSession } from '../../interfaces/IGraphSession';
import { DatabaseConfig, DatabaseInfo } from '../../interfaces/types';
import {
  ConnectionError,
  ConfigurationError,
  QueryError,
} from '../../errors';
import { Neo4jSession as GraphCoreNeo4jSession } from './Neo4jSession';

export class Neo4jDatabase implements IGraphDatabase {
  private driver: Driver | null = null;
  private connected = false;
  private config: DatabaseConfig | null = null;

  // ========================================
  // Connection Management
  // ========================================

  async connect(config: DatabaseConfig): Promise<void> {
    if (config.backend !== 'neo4j') {
      throw new ConfigurationError('Invalid backend for Neo4jDatabase');
    }

    if (!config.uri || !config.username || !config.password) {
      throw new ConfigurationError('Neo4j requires uri, username, and password');
    }

    this.config = config;

    try {
      this.driver = neo4j.driver(
        config.uri,
        neo4j.auth.basic(config.username, config.password),
        {
          maxConnectionPoolSize: 50,
          connectionAcquisitionTimeout: 60000,
        }
      );

      // Verify connection
      await this.driver.verifyConnectivity();
      this.connected = true;
    } catch (error) {
      throw new ConnectionError(
        `Failed to connect to Neo4j at ${config.uri}: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async disconnect(): Promise<void> {
    if (!this.driver) {
      return;
    }

    try {
      await this.driver.close();
      this.driver = null;
      this.connected = false;
    } catch (error) {
      throw new ConnectionError(
        `Failed to disconnect from Neo4j: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async ping(): Promise<boolean> {
    if (!this.driver) {
      return false;
    }

    try {
      await this.driver.verifyConnectivity();
      return true;
    } catch {
      return false;
    }
  }

  async getInfo(): Promise<DatabaseInfo> {
    this.ensureConnected();

    const session = this.driver!.session();

    try {
      // Get version
      const versionResult = await session.run('CALL dbms.components() YIELD versions RETURN versions[0] as version');
      const version = versionResult.records[0]?.get('version') || 'unknown';

      // Get node count
      const nodeCountResult = await session.run('MATCH (n) RETURN count(n) as count');
      const nodeCount = nodeCountResult.records[0]?.get('count')?.toNumber() || 0;

      // Get relationship count
      const relCountResult = await session.run('MATCH ()-[r]->() RETURN count(r) as count');
      const relationshipCount = relCountResult.records[0]?.get('count')?.toNumber() || 0;

      return {
        backend: 'neo4j',
        version,
        connected: this.connected,
        nodeCount,
        relationshipCount,
      };
    } catch (error) {
      throw new QueryError(
        `Failed to get database info: ${(error as Error).message}`,
        undefined,
        undefined,
        error as Error
      );
    } finally {
      await session.close();
    }
  }

  // ========================================
  // Session Management
  // ========================================

  session(): IGraphSession {
    this.ensureConnected();

    const neo4jSession = this.driver!.session({
      database: this.config?.database || 'neo4j',
    });

    return new GraphCoreNeo4jSession(neo4jSession);
  }

  // ========================================
  // Database Maintenance
  // ========================================

  async clear(): Promise<void> {
    this.ensureConnected();

    const session = this.driver!.session();

    try {
      await session.run('MATCH (n) DETACH DELETE n');
    } catch (error) {
      throw new QueryError(
        `Failed to clear database: ${(error as Error).message}`,
        'MATCH (n) DETACH DELETE n',
        undefined,
        error as Error
      );
    } finally {
      await session.close();
    }
  }

  async migrate(version?: string): Promise<void> {
    this.ensureConnected();

    // For now, just ensure basic indexes exist
    // In the future, this could run migration scripts based on version
    await this.createIndexes([
      { label: 'State', properties: ['id'] },
      { label: 'User', properties: ['id'] },
    ]);
  }

  async createIndexes(definitions: IndexDefinition[]): Promise<void> {
    this.ensureConnected();

    const session = this.driver!.session();

    try {
      for (const def of definitions) {
        const indexName = `${def.label}_${def.properties.join('_')}_index`;
        const props = def.properties.join(', n.');

        const query = `
          CREATE INDEX ${indexName} IF NOT EXISTS
          FOR (n:${def.label})
          ON (n.${props})
        `;

        await session.run(query);
      }
    } catch (error) {
      throw new QueryError(
        `Failed to create indexes: ${(error as Error).message}`,
        undefined,
        undefined,
        error as Error
      );
    } finally {
      await session.close();
    }
  }

  async export(format: 'json' | 'cypher' | 'graphml'): Promise<string> {
    this.ensureConnected();

    if (format !== 'json') {
      throw new ConfigurationError(`Export format "${format}" not yet implemented`);
    }

    const session = this.driver!.session();

    try {
      // Export as JSON
      const nodesResult = await session.run('MATCH (n) RETURN n, labels(n) as labels');
      const relsResult = await session.run('MATCH ()-[r]->() RETURN r, type(r) as type');

      const nodes = nodesResult.records.map((record) => ({
        labels: record.get('labels'),
        properties: record.get('n').properties,
      }));

      const relationships = relsResult.records.map((record) => ({
        type: record.get('type'),
        properties: record.get('r').properties,
      }));

      return JSON.stringify({ nodes, relationships }, null, 2);
    } catch (error) {
      throw new QueryError(
        `Failed to export database: ${(error as Error).message}`,
        undefined,
        undefined,
        error as Error
      );
    } finally {
      await session.close();
    }
  }

  async import(data: string, format: 'json' | 'cypher' | 'graphml'): Promise<void> {
    this.ensureConnected();

    if (format !== 'json') {
      throw new ConfigurationError(`Import format "${format}" not yet implemented`);
    }

    const session = this.driver!.session();

    try {
      const parsed = JSON.parse(data);

      // Import nodes
      for (const node of parsed.nodes || []) {
        const label = node.labels[0] || 'Node';
        await session.run(
          `CREATE (n:${label}) SET n = $properties`,
          { properties: node.properties }
        );
      }

      // Import relationships
      for (const rel of parsed.relationships || []) {
        await session.run(
          `MATCH (from), (to) CREATE (from)-[r:${rel.type}]->(to) SET r = $properties`,
          { properties: rel.properties }
        );
      }
    } catch (error) {
      throw new QueryError(
        `Failed to import database: ${(error as Error).message}`,
        undefined,
        undefined,
        error as Error
      );
    } finally {
      await session.close();
    }
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  private ensureConnected(): void {
    if (!this.connected || !this.driver) {
      throw new ConnectionError('Not connected to Neo4j database');
    }
  }
}
