/**
 * Neo4j implementation of IGraphSession
 */
import { Session } from 'neo4j-driver';
import { IGraphSession } from '../../interfaces/IGraphSession';
import { GraphNode, GraphRelationship, NodeReference, GraphPath, QueryResult } from '../../interfaces/types';
export declare class Neo4jSession implements IGraphSession {
    private readonly session;
    private transaction;
    private active;
    constructor(session: Session);
    createNode(label: string, properties: Record<string, unknown>): Promise<GraphNode>;
    getNode(label: string, id: string): Promise<GraphNode | null>;
    updateNode(label: string, id: string, properties: Record<string, unknown>): Promise<GraphNode>;
    deleteNode(label: string, id: string): Promise<void>;
    findNodes(label: string, filter?: Record<string, unknown>): Promise<GraphNode[]>;
    createRelationship(from: NodeReference, type: string, to: NodeReference, properties?: Record<string, unknown>): Promise<GraphRelationship>;
    getRelationships(from: NodeReference, type: string): Promise<GraphRelationship[]>;
    deleteRelationship(relationshipId: string): Promise<void>;
    shortestPath(from: string, to: string): Promise<GraphPath | null>;
    allPaths(from: string, to: string, maxDepth?: number): Promise<GraphPath[]>;
    reachableFrom(nodeId: string): Promise<GraphNode[]>;
    hasPath(from: string, to: string): Promise<boolean>;
    rawQuery<T = unknown>(query: string, params?: Record<string, unknown>): Promise<QueryResult<T>>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    close(): Promise<void>;
    isActive(): boolean;
    private ensureActive;
    private run;
    private convertNode;
    private convertRelationship;
    private convertPath;
}
//# sourceMappingURL=Neo4jSession.d.ts.map