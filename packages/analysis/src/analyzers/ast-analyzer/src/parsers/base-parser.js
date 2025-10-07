class BaseParser {
  constructor(language, treeSitterLanguage) {
    this.language = language;
    this.treeSitterLanguage = treeSitterLanguage;
    this.parser = null;
  }

  initialize() {
    if (!this.parser) {
      const Parser = require('tree-sitter');
      this.parser = new Parser();
      this.parser.setLanguage(this.treeSitterLanguage);
    }
  }

  parse(sourceCode, filePath = null) {
    this.initialize();
    
    try {
      const tree = this.parser.parse(sourceCode);
      return this.extractStructure(tree, sourceCode, filePath);
    } catch (error) {
      throw new Error(`Failed to parse ${this.language} code: ${error.message}`);
    }
  }

  extractStructure(tree, sourceCode, filePath) {
    const structure = {
      filePath,
      language: this.language,
      functions: [],
      classes: [],
      imports: [],
      exports: [],
      variables: [],
      complexity: {
        cyclomaticComplexity: 0,
        cognitiveComplexity: 0,
        linesOfCode: sourceCode.split('\n').length,
        maintainabilityIndex: 0
      },
      dependencies: [],
      errors: []
    };

    try {
      this.traverseTree(tree.rootNode, sourceCode, structure);
      this.calculateComplexity(structure);
    } catch (error) {
      structure.errors.push(`Extraction error: ${error.message}`);
    }

    return structure;
  }

  traverseTree(node, sourceCode, structure) {
    // Visit current node
    this.visitNode(node, sourceCode, structure);
    
    // Recursively visit all children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      this.traverseTree(child, sourceCode, structure);
    }
  }

  visitNode(node, sourceCode, structure) {
    // To be implemented by subclasses
  }

  getNodeText(node, sourceCode) {
    return sourceCode.substring(node.startIndex, node.endIndex);
  }

  getNodeLocation(node) {
    return {
      start: {
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1
      },
      end: {
        line: node.endPosition.row + 1,
        column: node.endPosition.column + 1
      }
    };
  }

  calculateComplexity(structure) {
    // Basic complexity calculations
    let cyclomaticComplexity = 1; // Base complexity
    let cognitiveComplexity = 0;

    // Count decision points in functions
    structure.functions.forEach(func => {
      cyclomaticComplexity += func.complexity?.branches || 0;
      cognitiveComplexity += func.complexity?.cognitive || 0;
    });

    structure.complexity.cyclomaticComplexity = cyclomaticComplexity;
    structure.complexity.cognitiveComplexity = cognitiveComplexity;
    
    // Simple maintainability index approximation
    const loc = structure.complexity.linesOfCode;
    const complexity = cyclomaticComplexity;
    structure.complexity.maintainabilityIndex = Math.max(0, 
      171 - 5.2 * Math.log(loc) - 0.23 * complexity - 16.2 * Math.log(loc / 1000)
    );
  }

  extractFunctionSignature(node, sourceCode) {
    return {
      name: 'unknown',
      parameters: [],
      returnType: null,
      location: this.getNodeLocation(node),
      complexity: {
        branches: 0,
        cognitive: 0,
        depth: 0
      }
    };
  }

  extractClassInfo(node, sourceCode) {
    return {
      name: 'unknown',
      methods: [],
      properties: [],
      inheritance: [],
      location: this.getNodeLocation(node)
    };
  }

  extractImportInfo(node, sourceCode) {
    return {
      module: 'unknown',
      imports: [],
      type: 'unknown',
      location: this.getNodeLocation(node)
    };
  }

  static getSupportedExtensions() {
    return [];
  }

  static getLanguageName() {
    return 'base';
  }
}

module.exports = BaseParser;