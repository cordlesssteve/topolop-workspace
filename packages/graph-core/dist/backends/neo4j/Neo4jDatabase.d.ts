/**
 * Neo4j implementation of IGraphDatabase
 */
import { IGraphDatabase, IndexDefinition } from '../../interfaces/IGraphDatabase';
import { IGraphSession } from '../../interfaces/IGraphSession';
import { DatabaseConfig, DatabaseInfo } from '../../interfaces/types';
export declare class Neo4jDatabase implements IGraphDatabase {
    private driver;
    private connected;
    private config;
    connect(config: DatabaseConfig): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    ping(): Promise<boolean>;
    getInfo(): Promise<DatabaseInfo>;
    session(): IGraphSession;
    clear(): Promise<void>;
    migrate(version?: string): Promise<void>;
    createIndexes(definitions: IndexDefinition[]): Promise<void>;
    export(format: 'json' | 'cypher' | 'graphml'): Promise<string>;
    import(data: string, format: 'json' | 'cypher' | 'graphml'): Promise<void>;
    private ensureConnected;
}
//# sourceMappingURL=Neo4jDatabase.d.ts.map