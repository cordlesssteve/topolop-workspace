# @topolop/graph-core

Database-agnostic graph storage abstraction layer with Neo4j and SQLite backends.

## Overview

`@topolop/graph-core` provides a unified interface for working with graph databases, allowing you to switch between Neo4j and SQLite backends without changing your application code.

## Features

- **Backend-agnostic API** - Write once, run on multiple databases
- **Transaction support** - All operations are transaction-scoped
- **Type-safe** - Full TypeScript support with comprehensive type definitions
- **Graph queries** - Shortest path, all paths, reachability analysis
- **Property serialization** - Automatic handling of complex objects
- **Error handling** - Comprehensive error hierarchy for debugging

## Installation

```bash
npm install @topolop/graph-core
```

### Peer Dependencies

Depending on which backend you want to use, install the appropriate driver:

```bash
# For Neo4j backend
npm install neo4j-driver

# For SQLite backend
npm install better-sqlite3
```

## Quick Start

### Neo4j Backend

```typescript
import { createGraphDatabase } from '@topolop/graph-core';

const db = createGraphDatabase();

await db.connect({
  backend: 'neo4j',
  uri: 'neo4j://localhost:7687',
  username: 'neo4j',
  password: 'password'
});

// Create a session
const session = db.session();

try {
  // Create nodes
  const alice = await session.createNode('User', { name: 'Alice', age: 30 });
  const bob = await session.createNode('User', { name: 'Bob', age: 25 });

  // Create relationship
  await session.createRelationship(
    { label: 'User', id: alice.id },
    'FRIENDS_WITH',
    { label: 'User', id: bob.id },
    { since: '2024-01-01' }
  );

  // Commit transaction
  await session.commit();
} finally {
  await session.close();
}

await db.disconnect();
```

### SQLite Backend

```typescript
import { createGraphDatabase } from '@topolop/graph-core';

const db = createGraphDatabase();

await db.connect({
  backend: 'sqlite',
  filePath: './my-graph.db'
});

// Same API as Neo4j!
const session = db.session();
// ... rest of code is identical
```

## API Reference

### Core Interfaces

#### `IGraphDatabase`

Main database connection interface:

- `connect(config: DatabaseConfig): Promise<void>` - Connect to database
- `disconnect(): Promise<void>` - Disconnect from database
- `session(): IGraphSession` - Create new transaction session
- `ping(): Promise<boolean>` - Check database connectivity
- `getInfo(): Promise<DatabaseInfo>` - Get database information

#### `IGraphSession`

Transaction-scoped session interface:

**Node Operations:**
- `createNode(label, properties)` - Create new node
- `getNode(label, id)` - Get node by ID
- `updateNode(label, id, properties)` - Update node properties
- `deleteNode(label, id)` - Delete node
- `findNodes(label, filter?)` - Find nodes matching filter

**Relationship Operations:**
- `createRelationship(from, type, to, properties?)` - Create relationship
- `getRelationships(from, type)` - Get relationships from node
- `deleteRelationship(id)` - Delete relationship

**Graph Queries:**
- `shortestPath(from, to)` - Find shortest path
- `allPaths(from, to, maxDepth?)` - Find all paths
- `reachableFrom(nodeId)` - Get reachable nodes
- `hasPath(from, to)` - Check if path exists

**Transaction Control:**
- `commit()` - Commit transaction
- `rollback()` - Rollback transaction
- `close()` - Close session

### Types

```typescript
interface DatabaseConfig {
  backend: 'neo4j' | 'sqlite';
  uri?: string;           // For Neo4j
  username?: string;      // For Neo4j
  password?: string;      // For Neo4j
  filePath?: string;      // For SQLite
}

interface GraphNode {
  id: string;
  label: string;
  properties: Record<string, unknown>;
}

interface GraphRelationship {
  id: string;
  type: string;
  from: string;
  to: string;
  properties: Record<string, unknown>;
}
```

## Error Handling

The package provides a comprehensive error hierarchy:

```typescript
import {
  GraphDatabaseError,
  ConnectionError,
  QueryError,
  ValidationError,
  NotFoundError
} from '@topolop/graph-core';

try {
  await session.getNode('User', 'nonexistent-id');
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('Node not found');
  } else if (error instanceof QueryError) {
    console.log('Query failed:', error.query);
  }
}
```

## Property Serialization

Complex objects are automatically serialized for Neo4j:

```typescript
// Input
await session.createNode('State', {
  id: 'login',
  metadata: { foo: 'bar' },  // Complex object
  tags: ['important']         // Array
});

// Stored in Neo4j as:
// { id: 'login', metadataJson: '{"foo":"bar"}', tags: ['important'] }

// Retrieved as original:
const node = await session.getNode('State', 'login');
console.log(node.properties.metadata);  // { foo: 'bar' }
```

## Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Coverage report
npm run test:coverage
```

## Development

```bash
# Build the package
npm run build

# Run TypeScript type checking
npm run typecheck

# Lint code
npm run lint

# Run validation (typecheck + lint + test)
npm run validate
```

## License

MIT

## Author

cordlesssteve
