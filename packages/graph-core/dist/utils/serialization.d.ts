/**
 * Utility functions for property serialization/deserialization
 */
/**
 * Serialize complex properties for Neo4j storage
 *
 * Neo4j only supports primitive types and arrays of primitives.
 * Complex objects are converted to JSON strings with a "Json" suffix.
 *
 * @example
 * Input:  { id: "1", metadata: { foo: "bar" } }
 * Output: { id: "1", metadataJson: '{"foo":"bar"}' }
 */
export declare function serializeProperties(props: Record<string, unknown>): Record<string, unknown>;
/**
 * Deserialize properties from Neo4j storage
 *
 * Converts JSON strings (with "Json" suffix) back to objects.
 *
 * @example
 * Input:  { id: "1", metadataJson: '{"foo":"bar"}' }
 * Output: { id: "1", metadata: { foo: "bar" } }
 */
export declare function deserializeProperties(props: Record<string, unknown>): Record<string, unknown>;
/**
 * Check if a value is a primitive type
 */
export declare function isPrimitive(value: unknown): boolean;
/**
 * Validate that properties are compatible with database storage
 */
export declare function validateProperties(props: Record<string, unknown>): void;
//# sourceMappingURL=serialization.d.ts.map