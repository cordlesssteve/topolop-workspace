"use strict";
/**
 * Neo4j implementation of IGraphDatabase
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Neo4jDatabase = void 0;
const neo4j_driver_1 = __importDefault(require("neo4j-driver"));
const errors_1 = require("../../errors");
const Neo4jSession_1 = require("./Neo4jSession");
class Neo4jDatabase {
    constructor() {
        this.driver = null;
        this.connected = false;
        this.config = null;
    }
    // ========================================
    // Connection Management
    // ========================================
    async connect(config) {
        if (config.backend !== 'neo4j') {
            throw new errors_1.ConfigurationError('Invalid backend for Neo4jDatabase');
        }
        if (!config.uri || !config.username || !config.password) {
            throw new errors_1.ConfigurationError('Neo4j requires uri, username, and password');
        }
        this.config = config;
        try {
            this.driver = neo4j_driver_1.default.driver(config.uri, neo4j_driver_1.default.auth.basic(config.username, config.password), {
                maxConnectionPoolSize: 50,
                connectionAcquisitionTimeout: 60000,
            });
            // Verify connection
            await this.driver.verifyConnectivity();
            this.connected = true;
        }
        catch (error) {
            throw new errors_1.ConnectionError(`Failed to connect to Neo4j at ${config.uri}: ${error.message}`, error);
        }
    }
    async disconnect() {
        if (!this.driver) {
            return;
        }
        try {
            await this.driver.close();
            this.driver = null;
            this.connected = false;
        }
        catch (error) {
            throw new errors_1.ConnectionError(`Failed to disconnect from Neo4j: ${error.message}`, error);
        }
    }
    isConnected() {
        return this.connected;
    }
    async ping() {
        if (!this.driver) {
            return false;
        }
        try {
            await this.driver.verifyConnectivity();
            return true;
        }
        catch {
            return false;
        }
    }
    async getInfo() {
        this.ensureConnected();
        const session = this.driver.session();
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
        }
        catch (error) {
            throw new errors_1.QueryError(`Failed to get database info: ${error.message}`, undefined, undefined, error);
        }
        finally {
            await session.close();
        }
    }
    // ========================================
    // Session Management
    // ========================================
    session() {
        this.ensureConnected();
        const neo4jSession = this.driver.session({
            database: this.config?.database || 'neo4j',
        });
        return new Neo4jSession_1.Neo4jSession(neo4jSession);
    }
    // ========================================
    // Database Maintenance
    // ========================================
    async clear() {
        this.ensureConnected();
        const session = this.driver.session();
        try {
            await session.run('MATCH (n) DETACH DELETE n');
        }
        catch (error) {
            throw new errors_1.QueryError(`Failed to clear database: ${error.message}`, 'MATCH (n) DETACH DELETE n', undefined, error);
        }
        finally {
            await session.close();
        }
    }
    async migrate(version) {
        this.ensureConnected();
        // For now, just ensure basic indexes exist
        // In the future, this could run migration scripts based on version
        await this.createIndexes([
            { label: 'State', properties: ['id'] },
            { label: 'User', properties: ['id'] },
        ]);
    }
    async createIndexes(definitions) {
        this.ensureConnected();
        const session = this.driver.session();
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
        }
        catch (error) {
            throw new errors_1.QueryError(`Failed to create indexes: ${error.message}`, undefined, undefined, error);
        }
        finally {
            await session.close();
        }
    }
    async export(format) {
        this.ensureConnected();
        if (format !== 'json') {
            throw new errors_1.ConfigurationError(`Export format "${format}" not yet implemented`);
        }
        const session = this.driver.session();
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
        }
        catch (error) {
            throw new errors_1.QueryError(`Failed to export database: ${error.message}`, undefined, undefined, error);
        }
        finally {
            await session.close();
        }
    }
    async import(data, format) {
        this.ensureConnected();
        if (format !== 'json') {
            throw new errors_1.ConfigurationError(`Import format "${format}" not yet implemented`);
        }
        const session = this.driver.session();
        try {
            const parsed = JSON.parse(data);
            // Import nodes
            for (const node of parsed.nodes || []) {
                const label = node.labels[0] || 'Node';
                await session.run(`CREATE (n:${label}) SET n = $properties`, { properties: node.properties });
            }
            // Import relationships
            for (const rel of parsed.relationships || []) {
                await session.run(`MATCH (from), (to) CREATE (from)-[r:${rel.type}]->(to) SET r = $properties`, { properties: rel.properties });
            }
        }
        catch (error) {
            throw new errors_1.QueryError(`Failed to import database: ${error.message}`, undefined, undefined, error);
        }
        finally {
            await session.close();
        }
    }
    // ========================================
    // Private Helper Methods
    // ========================================
    ensureConnected() {
        if (!this.connected || !this.driver) {
            throw new errors_1.ConnectionError('Not connected to Neo4j database');
        }
    }
}
exports.Neo4jDatabase = Neo4jDatabase;
//# sourceMappingURL=Neo4jDatabase.js.map