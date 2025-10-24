"use strict";
/**
 * Neo4j implementation of IGraphSession
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Neo4jSession = void 0;
const errors_1 = require("../../errors");
const serialization_1 = require("../../utils/serialization");
class Neo4jSession {
    constructor(session) {
        this.session = session;
        this.transaction = null;
        this.active = true;
        this.transaction = this.session.beginTransaction();
    }
    // ========================================
    // Node Operations
    // ========================================
    async createNode(label, properties) {
        this.ensureActive();
        (0, serialization_1.validateProperties)(properties);
        const serialized = (0, serialization_1.serializeProperties)(properties);
        const query = `
      CREATE (n:${label})
      SET n = $properties
      RETURN n
    `;
        try {
            const result = await this.run(query, { properties: serialized });
            const record = result.records[0];
            if (!record) {
                throw new errors_1.QueryError('Failed to create node', query);
            }
            const node = record.get('n');
            return this.convertNode(label, node);
        }
        catch (error) {
            throw new errors_1.QueryError(`Failed to create node: ${error.message}`, query, { properties: serialized }, error);
        }
    }
    async getNode(label, id) {
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
        }
        catch (error) {
            throw new errors_1.QueryError(`Failed to get node: ${error.message}`, query, { id }, error);
        }
    }
    async updateNode(label, id, properties) {
        this.ensureActive();
        (0, serialization_1.validateProperties)(properties);
        const serialized = (0, serialization_1.serializeProperties)(properties);
        const query = `
      MATCH (n:${label} {id: $id})
      SET n += $properties
      RETURN n
    `;
        try {
            const result = await this.run(query, { id, properties: serialized });
            const record = result.records[0];
            if (!record) {
                throw new errors_1.NotFoundError(`Node not found`, label, id);
            }
            const node = record.get('n');
            return this.convertNode(label, node);
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError)
                throw error;
            throw new errors_1.QueryError(`Failed to update node: ${error.message}`, query, { id, properties: serialized }, error);
        }
    }
    async deleteNode(label, id) {
        this.ensureActive();
        const query = `
      MATCH (n:${label} {id: $id})
      DETACH DELETE n
    `;
        try {
            await this.run(query, { id });
        }
        catch (error) {
            throw new errors_1.QueryError(`Failed to delete node: ${error.message}`, query, { id }, error);
        }
    }
    async findNodes(label, filter) {
        this.ensureActive();
        let query = `MATCH (n:${label})`;
        const params = {};
        if (filter && Object.keys(filter).length > 0) {
            (0, serialization_1.validateProperties)(filter);
            const serialized = (0, serialization_1.serializeProperties)(filter);
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
        }
        catch (error) {
            throw new errors_1.QueryError(`Failed to find nodes: ${error.message}`, query, params, error);
        }
    }
    // ========================================
    // Relationship Operations
    // ========================================
    async createRelationship(from, type, to, properties) {
        this.ensureActive();
        if (properties) {
            (0, serialization_1.validateProperties)(properties);
        }
        const serialized = properties ? (0, serialization_1.serializeProperties)(properties) : {};
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
                throw new errors_1.QueryError('Failed to create relationship', query);
            }
            const rel = record.get('r');
            const relId = record.get('relId');
            return this.convertRelationship(type, from.id, to.id, relId, rel);
        }
        catch (error) {
            throw new errors_1.QueryError(`Failed to create relationship: ${error.message}`, query, { fromId: from.id, toId: to.id, properties: serialized }, error);
        }
    }
    async getRelationships(from, type) {
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
        }
        catch (error) {
            throw new errors_1.QueryError(`Failed to get relationships: ${error.message}`, query, { fromId: from.id }, error);
        }
    }
    async deleteRelationship(relationshipId) {
        this.ensureActive();
        const query = `
      MATCH ()-[r]->()
      WHERE id(r) = $relId
      DELETE r
    `;
        try {
            await this.run(query, { relId: parseInt(relationshipId, 10) });
        }
        catch (error) {
            throw new errors_1.QueryError(`Failed to delete relationship: ${error.message}`, query, { relId: relationshipId }, error);
        }
    }
    // ========================================
    // Graph Query Operations
    // ========================================
    async shortestPath(from, to) {
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
        }
        catch (error) {
            throw new errors_1.QueryError(`Failed to find shortest path: ${error.message}`, query, { fromId: from, toId: to }, error);
        }
    }
    async allPaths(from, to, maxDepth = 10) {
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
        }
        catch (error) {
            throw new errors_1.QueryError(`Failed to find all paths: ${error.message}`, query, { fromId: from, toId: to }, error);
        }
    }
    async reachableFrom(nodeId) {
        this.ensureActive();
        const query = `
      MATCH (start {id: $nodeId})-[*]->(reachable)
      RETURN DISTINCT reachable, labels(reachable) as labels
    `;
        try {
            const result = await this.run(query, { nodeId });
            return result.records.map((record) => {
                const node = record.get('reachable');
                const labels = record.get('labels');
                const label = labels[0] || 'Node';
                return this.convertNode(label, node);
            });
        }
        catch (error) {
            throw new errors_1.QueryError(`Failed to find reachable nodes: ${error.message}`, query, { nodeId }, error);
        }
    }
    async hasPath(from, to) {
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
        }
        catch (error) {
            throw new errors_1.QueryError(`Failed to check path existence: ${error.message}`, query, { fromId: from, toId: to }, error);
        }
    }
    async rawQuery(query, params) {
        this.ensureActive();
        try {
            const result = await this.run(query, params || {});
            return {
                records: result.records.map((record) => record.toObject()),
                summary: {
                    queryType: result.summary.queryType,
                    counters: result.summary.counters,
                },
            };
        }
        catch (error) {
            throw new errors_1.QueryError(`Raw query failed: ${error.message}`, query, params, error);
        }
    }
    // ========================================
    // Transaction Control
    // ========================================
    async commit() {
        this.ensureActive();
        if (!this.transaction) {
            throw new errors_1.TransactionError('No active transaction');
        }
        try {
            await this.transaction.commit();
            this.active = false;
        }
        catch (error) {
            throw new errors_1.TransactionError(`Failed to commit transaction: ${error.message}`, error);
        }
    }
    async rollback() {
        this.ensureActive();
        if (!this.transaction) {
            throw new errors_1.TransactionError('No active transaction');
        }
        try {
            await this.transaction.rollback();
            this.active = false;
        }
        catch (error) {
            throw new errors_1.TransactionError(`Failed to rollback transaction: ${error.message}`, error);
        }
    }
    async close() {
        if (!this.active) {
            return;
        }
        // Auto-commit if not already committed/rolled back
        if (this.transaction) {
            try {
                await this.transaction.commit();
            }
            catch (error) {
                // Ignore commit errors on close
            }
        }
        this.active = false;
        await this.session.close();
    }
    isActive() {
        return this.active;
    }
    // ========================================
    // Private Helper Methods
    // ========================================
    ensureActive() {
        if (!this.active) {
            throw new errors_1.TransactionError('Session is not active');
        }
    }
    async run(query, params) {
        if (!this.transaction) {
            throw new errors_1.TransactionError('No active transaction');
        }
        return this.transaction.run(query, params);
    }
    convertNode(label, node) {
        const props = node.properties || {};
        const deserialized = (0, serialization_1.deserializeProperties)(props);
        return {
            id: props.id || node.identity?.toString() || '',
            label,
            properties: deserialized,
        };
    }
    convertRelationship(type, fromId, toId, relId, rel) {
        const props = rel.properties || {};
        const deserialized = (0, serialization_1.deserializeProperties)(props);
        return {
            id: relId.toString(),
            type,
            from: fromId,
            to: toId,
            properties: deserialized,
        };
    }
    convertPath(path) {
        const segments = [];
        const nodes = path.segments || [];
        for (const segment of nodes) {
            const node = segment.start;
            const rel = segment.relationship;
            const labels = node.labels || [];
            const label = labels[0] || 'Node';
            segments.push({
                node: this.convertNode(label, node),
                relationship: rel ? this.convertRelationship(rel.type, segment.start.identity?.toString() || '', segment.end.identity?.toString() || '', rel.identity, rel) : undefined,
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
exports.Neo4jSession = Neo4jSession;
//# sourceMappingURL=Neo4jSession.js.map