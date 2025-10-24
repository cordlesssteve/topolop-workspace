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
export function serializeProperties(props: Record<string, unknown>): Record<string, unknown> {
  const serialized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) {
      // Skip null/undefined values
      continue;
    }

    if (Array.isArray(value)) {
      // Check if array contains only primitives
      const isPrimitiveArray = value.every(
        (item) => typeof item !== 'object' || item === null
      );

      if (isPrimitiveArray) {
        serialized[key] = value;
      } else {
        serialized[`${key}Json`] = JSON.stringify(value);
      }
    } else if (typeof value === 'object') {
      // Complex object - serialize to JSON string
      serialized[`${key}Json`] = JSON.stringify(value);
    } else {
      // Primitive value - store as-is
      serialized[key] = value;
    }
  }

  return serialized;
}

/**
 * Deserialize properties from Neo4j storage
 *
 * Converts JSON strings (with "Json" suffix) back to objects.
 *
 * @example
 * Input:  { id: "1", metadataJson: '{"foo":"bar"}' }
 * Output: { id: "1", metadata: { foo: "bar" } }
 */
export function deserializeProperties(props: Record<string, unknown>): Record<string, unknown> {
  const deserialized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (key.endsWith('Json') && typeof value === 'string') {
      // Remove "Json" suffix and parse
      const originalKey = key.slice(0, -4);
      try {
        deserialized[originalKey] = JSON.parse(value);
      } catch (error) {
        // If JSON parse fails, keep as string
        deserialized[originalKey] = value;
      }
    } else {
      // Keep as-is
      deserialized[key] = value;
    }
  }

  return deserialized;
}

/**
 * Check if a value is a primitive type
 */
export function isPrimitive(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/**
 * Validate that properties are compatible with database storage
 */
export function validateProperties(props: Record<string, unknown>): void {
  // Check all keys including symbol keys
  for (const key of Object.getOwnPropertyNames(props)) {
    if (key.includes('.')) {
      throw new Error(`Property key "${key}" contains invalid character "."`);
    }

    const value = props[key];

    if (typeof value === 'function') {
      throw new Error(`Property "${key}" cannot be a function`);
    }

    if (typeof value === 'symbol') {
      throw new Error(`Property "${key}" cannot be a symbol`);
    }
  }

  // Check for symbol keys
  const symbolKeys = Object.getOwnPropertySymbols(props);
  if (symbolKeys.length > 0) {
    throw new Error(`Property keys cannot be symbols`);
  }
}
