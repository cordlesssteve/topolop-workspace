/**
 * Unit tests for property serialization utilities
 */

import {
  serializeProperties,
  deserializeProperties,
  isPrimitive,
  validateProperties,
} from '../../src/utils/serialization';

describe('Serialization Utilities', () => {
  describe('isPrimitive', () => {
    it('should identify primitive types', () => {
      expect(isPrimitive(null)).toBe(true);
      expect(isPrimitive(undefined)).toBe(true);
      expect(isPrimitive('string')).toBe(true);
      expect(isPrimitive(42)).toBe(true);
      expect(isPrimitive(true)).toBe(true);
    });

    it('should identify non-primitive types', () => {
      expect(isPrimitive({})).toBe(false);
      expect(isPrimitive([])).toBe(false);
      expect(isPrimitive(() => {})).toBe(false);
    });
  });

  describe('validateProperties', () => {
    it('should accept valid properties', () => {
      expect(() => {
        validateProperties({
          id: 'test',
          name: 'Alice',
          age: 30,
          tags: ['a', 'b'],
        });
      }).not.toThrow();
    });

    it('should reject property keys with dots', () => {
      expect(() => {
        validateProperties({
          'invalid.key': 'value',
        });
      }).toThrow('contains invalid character "."');
    });

    it('should reject function properties', () => {
      expect(() => {
        validateProperties({
          invalid: () => {},
        });
      }).toThrow('cannot be a function');
    });

    it('should reject symbol properties', () => {
      expect(() => {
        validateProperties({
          [Symbol('test')]: 'value',
        });
      }).toThrow('Property keys cannot be symbols');
    });
  });

  describe('serializeProperties', () => {
    it('should keep primitive values as-is', () => {
      const input = {
        id: 'test123',
        name: 'Alice',
        age: 30,
        active: true,
      };

      const result = serializeProperties(input);

      expect(result).toEqual({
        id: 'test123',
        name: 'Alice',
        age: 30,
        active: true,
      });
    });

    it('should serialize complex objects to JSON strings', () => {
      const input = {
        id: 'test',
        metadata: {
          foo: 'bar',
          nested: { value: 42 },
        },
      };

      const result = serializeProperties(input);

      expect(result).toEqual({
        id: 'test',
        metadataJson: '{"foo":"bar","nested":{"value":42}}',
      });
    });

    it('should handle primitive arrays as-is', () => {
      const input = {
        tags: ['important', 'test'],
        numbers: [1, 2, 3],
      };

      const result = serializeProperties(input);

      expect(result).toEqual({
        tags: ['important', 'test'],
        numbers: [1, 2, 3],
      });
    });

    it('should serialize complex arrays to JSON strings', () => {
      const input = {
        items: [{ id: 1 }, { id: 2 }],
      };

      const result = serializeProperties(input);

      expect(result).toEqual({
        itemsJson: '[{"id":1},{"id":2}]',
      });
    });

    it('should skip null and undefined values', () => {
      const input = {
        id: 'test',
        nullable: null,
        undef: undefined,
        value: 42,
      };

      const result = serializeProperties(input);

      expect(result).toEqual({
        id: 'test',
        value: 42,
      });
      expect(result.nullable).toBeUndefined();
      expect(result.undef).toBeUndefined();
    });
  });

  describe('deserializeProperties', () => {
    it('should keep primitive values as-is', () => {
      const input = {
        id: 'test123',
        name: 'Alice',
        age: 30,
        active: true,
      };

      const result = deserializeProperties(input);

      expect(result).toEqual(input);
    });

    it('should deserialize JSON strings back to objects', () => {
      const input = {
        id: 'test',
        metadataJson: '{"foo":"bar","nested":{"value":42}}',
      };

      const result = deserializeProperties(input);

      expect(result).toEqual({
        id: 'test',
        metadata: {
          foo: 'bar',
          nested: { value: 42 },
        },
      });
    });

    it('should handle invalid JSON gracefully', () => {
      const input = {
        id: 'test',
        invalidJson: 'not valid json',
      };

      const result = deserializeProperties(input);

      // Should keep as string if JSON parse fails
      expect(result).toEqual({
        id: 'test',
        invalid: 'not valid json',
      });
    });

    it('should handle mixed property types', () => {
      const input = {
        id: 'test',
        name: 'Alice',
        metadataJson: '{"foo":"bar"}',
        tags: ['important', 'test'],
      };

      const result = deserializeProperties(input);

      expect(result).toEqual({
        id: 'test',
        name: 'Alice',
        metadata: { foo: 'bar' },
        tags: ['important', 'test'],
      });
    });
  });

  describe('Round-trip serialization', () => {
    it('should preserve data through serialize -> deserialize', () => {
      const original = {
        id: 'test',
        name: 'Alice',
        age: 30,
        metadata: {
          foo: 'bar',
          nested: { value: 42 },
        },
        tags: ['important', 'test'],
      };

      const serialized = serializeProperties(original);
      const deserialized = deserializeProperties(serialized);

      expect(deserialized).toEqual(original);
    });

    it('should handle complex nested structures', () => {
      const original = {
        id: 'complex',
        data: {
          level1: {
            level2: {
              level3: {
                value: 'deep',
                numbers: [1, 2, 3],
              },
            },
          },
        },
      };

      const serialized = serializeProperties(original);
      const deserialized = deserializeProperties(serialized);

      expect(deserialized).toEqual(original);
    });
  });
});
