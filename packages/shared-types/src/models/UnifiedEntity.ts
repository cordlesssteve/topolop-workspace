/**
 * Unified Entity constructor parameters
 */
export interface UnifiedEntityParams {
  id: string;
  type: string;
  name: string;
  canonicalPath: string;
}

/**
 * Canonical entity identification for cross-tool correlation
 * All tools normalize to relative-from-project-root paths
 */
export class UnifiedEntity {
  public id: string;
  public type: string;
  public name: string;
  public canonicalPath: string;        // "src/main/java/App.java" (universal)
  public originalIdentifier: string;   // Tool's native ID for debugging
  public toolName: string;             // Source tool name
  public confidence: number;           // Normalization confidence (0-1)

  constructor(params: UnifiedEntityParams);
  constructor(canonicalPath: string, originalIdentifier: string, toolName: string);
  constructor(
    paramsOrCanonicalPath: UnifiedEntityParams | string,
    originalIdentifier?: string,
    toolName?: string
  ) {
    if (typeof paramsOrCanonicalPath === 'string') {
      // Legacy constructor for backward compatibility
      this.canonicalPath = paramsOrCanonicalPath;
      this.originalIdentifier = originalIdentifier!;
      this.toolName = toolName!;
      this.confidence = 1.0;
      this.id = `entity-${this.canonicalPath}`;
      this.type = 'file';
      this.name = this.canonicalPath.split('/').pop() || this.canonicalPath;
    } else {
      // New constructor with parameters object
      this.id = paramsOrCanonicalPath.id;
      this.type = paramsOrCanonicalPath.type;
      this.name = paramsOrCanonicalPath.name;
      this.canonicalPath = paramsOrCanonicalPath.canonicalPath;
      this.originalIdentifier = this.canonicalPath;
      this.toolName = 'unified';
      this.confidence = 1.0;
    }
  }
}
