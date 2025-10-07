const BaseParser = require('./base-parser');

class JavaScriptParser extends BaseParser {
  constructor() {
    const JavaScript = require('tree-sitter-javascript');
    super('javascript', JavaScript);
  }

  visitNode(node, sourceCode, structure) {
    switch (node.type) {
      case 'function_declaration':
      case 'function_expression':
      case 'arrow_function':
      case 'method_definition':
        structure.functions.push(this.extractFunctionSignature(node, sourceCode));
        break;
        
      case 'class_declaration':
        structure.classes.push(this.extractClassInfo(node, sourceCode));
        break;
        
      case 'import_statement':
        structure.imports.push(this.extractImportInfo(node, sourceCode));
        break;
        
      case 'export_statement':
        structure.exports.push(this.extractExportInfo(node, sourceCode));
        break;
        
      case 'call_expression':
        // Check for require() calls
        const requireImport = this.extractRequireCall(node, sourceCode);
        if (requireImport) {
          structure.imports.push(requireImport);
        }
        break;
        
      case 'variable_declaration':
        this.extractVariables(node, sourceCode, structure);
        break;
    }
  }

  extractFunctionSignature(node, sourceCode) {
    let name = 'anonymous';
    let parameters = [];
    let returnType = null;

    // Find function name (usually child at index 1 for function_declaration)
    let nameNode = null;
    let paramsNode = null;
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if ((child.type === 'identifier' || child.type === 'property_identifier') && !nameNode) {
        nameNode = child;
      } else if (child.type === 'formal_parameters') {
        paramsNode = child;
      }
    }

    if (nameNode) {
      name = this.getNodeText(nameNode, sourceCode);
    }

    // Extract parameters
    if (paramsNode) {
      parameters = this.extractParameters(paramsNode, sourceCode);
    }

    // Calculate complexity
    const complexity = this.calculateFunctionComplexity(node, sourceCode);

    return {
      name,
      parameters,
      returnType,
      location: this.getNodeLocation(node),
      complexity,
      type: node.type,
      async: this.isAsync(node, sourceCode),
      generator: this.isGenerator(node, sourceCode)
    };
  }

  extractParameters(paramsNode, sourceCode) {
    const parameters = [];
    
    for (let i = 0; i < paramsNode.childCount; i++) {
      const param = paramsNode.child(i);
      
      if (param.type === 'identifier') {
        parameters.push({
          name: this.getNodeText(param, sourceCode),
          type: null,
          defaultValue: null
        });
      } else if (param.type === 'assignment_pattern') {
        // Default parameter - find left and right children
        let nameNode = null;
        let defaultNode = null;
        
        for (let j = 0; j < param.childCount; j++) {
          const child = param.child(j);
          if (child.type === 'identifier' && !nameNode) {
            nameNode = child;
          } else if (!defaultNode && child.type !== '=') {
            defaultNode = child;
          }
        }
        
        parameters.push({
          name: nameNode ? this.getNodeText(nameNode, sourceCode) : 'unknown',
          type: null,
          defaultValue: defaultNode ? this.getNodeText(defaultNode, sourceCode) : null
        });
      }
    }
    
    return parameters;
  }

  calculateFunctionComplexity(node, sourceCode) {
    let branches = 0;
    let cognitive = 0;
    let depth = 0;
    let maxDepth = 0;
    
    const countComplexity = (currentNode, currentDepth = 0) => {
      maxDepth = Math.max(maxDepth, currentDepth);
      
      switch (currentNode.type) {
        case 'if_statement':
        case 'while_statement':
        case 'for_statement':
        case 'for_in_statement':
        case 'for_of_statement':
        case 'switch_statement':
          branches++;
          cognitive += 1 + currentDepth;
          break;
          
        case 'conditional_expression': // ternary operator
        case 'logical_expression':
          branches++;
          cognitive += 1;
          break;
          
        case 'catch_clause':
          branches++;
          cognitive += 1;
          break;
      }
      
      const newDepth = ['if_statement', 'while_statement', 'for_statement', 'for_in_statement', 'for_of_statement']
        .includes(currentNode.type) ? currentDepth + 1 : currentDepth;
      
      for (const child of currentNode.children) {
        countComplexity(child, newDepth);
      }
    };
    
    countComplexity(node);
    
    return {
      branches,
      cognitive,
      depth: maxDepth
    };
  }

  extractClassInfo(node, sourceCode) {
    let nameNode = null;
    let bodyNode = null;
    let superclassNode = null;
    
    // Find class components by traversing children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === 'identifier' && !nameNode) {
        nameNode = child;
      } else if (child.type === 'class_body') {
        bodyNode = child;
      } else if (child.type === 'class_heritage') {
        // Look for extends clause
        for (let j = 0; j < child.childCount; j++) {
          const heritage = child.child(j);
          if (heritage.type === 'extends_clause' && heritage.childCount > 1) {
            superclassNode = heritage.child(1);
          }
        }
      }
    }
    
    const name = nameNode ? this.getNodeText(nameNode, sourceCode) : 'Anonymous';
    const methods = [];
    const properties = [];
    const inheritance = [];
    
    // Extract superclass
    if (superclassNode) {
      inheritance.push({
        type: 'extends',
        name: this.getNodeText(superclassNode, sourceCode)
      });
    }
    
    // Extract class body
    if (bodyNode) {
      for (let i = 0; i < bodyNode.childCount; i++) {
        const member = bodyNode.child(i);
        if (member.type === 'method_definition') {
          methods.push(this.extractFunctionSignature(member, sourceCode));
        } else if (member.type === 'field_definition' || member.type === 'property_definition') {
          properties.push(this.extractProperty(member, sourceCode));
        }
      }
    }
    
    return {
      name,
      methods,
      properties,
      inheritance,
      location: this.getNodeLocation(node)
    };
  }

  extractProperty(node, sourceCode) {
    const nameNode = node.childForFieldName('property');
    const name = nameNode ? this.getNodeText(nameNode, sourceCode) : 'unknown';
    
    return {
      name,
      static: this.hasModifier(node, 'static'),
      location: this.getNodeLocation(node)
    };
  }

  extractImportInfo(node, sourceCode) {
    const sourceNode = node.childForFieldName('source');
    const module = sourceNode ? this.getNodeText(sourceNode, sourceCode).replace(/['"]/g, '') : 'unknown';
    
    const imports = [];
    
    // Handle different import patterns
    const clauseNode = node.childForFieldName('import');
    if (clauseNode) {
      this.extractImportClause(clauseNode, sourceCode, imports);
    }
    
    return {
      module,
      imports,
      type: 'es6',
      location: this.getNodeLocation(node)
    };
  }

  extractImportClause(node, sourceCode, imports) {
    switch (node.type) {
      case 'import_specifier':
        const imported = node.childForFieldName('name');
        const local = node.childForFieldName('alias') || imported;
        
        imports.push({
          imported: imported ? this.getNodeText(imported, sourceCode) : null,
          local: local ? this.getNodeText(local, sourceCode) : null,
          type: 'named'
        });
        break;
        
      case 'namespace_import':
        const alias = node.childForFieldName('alias');
        imports.push({
          imported: '*',
          local: alias ? this.getNodeText(alias, sourceCode) : null,
          type: 'namespace'
        });
        break;
        
      case 'identifier':
        imports.push({
          imported: 'default',
          local: this.getNodeText(node, sourceCode),
          type: 'default'
        });
        break;
    }
    
    // Recursively handle child nodes
    for (const child of node.children) {
      this.extractImportClause(child, sourceCode, imports);
    }
  }

  extractExportInfo(node, sourceCode) {
    const exports = [];
    
    // Handle different export patterns
    if (node.type === 'export_statement') {
      const declarationNode = node.childForFieldName('declaration');
      if (declarationNode) {
        exports.push({
          name: this.extractExportName(declarationNode, sourceCode),
          type: 'declaration',
          location: this.getNodeLocation(declarationNode)
        });
      }
    }
    
    return {
      exports,
      location: this.getNodeLocation(node)
    };
  }

  extractExportName(node, sourceCode) {
    const nameNode = node.childForFieldName('name');
    return nameNode ? this.getNodeText(nameNode, sourceCode) : 'unknown';
  }

  extractVariables(node, sourceCode, structure) {
    for (const declarator of node.children) {
      if (declarator.type === 'variable_declarator') {
        const nameNode = declarator.childForFieldName('name');
        const valueNode = declarator.childForFieldName('value');
        
        if (nameNode) {
          structure.variables.push({
            name: this.getNodeText(nameNode, sourceCode),
            type: node.childForFieldName('kind') ? 
              this.getNodeText(node.childForFieldName('kind'), sourceCode) : 'var',
            hasInitializer: !!valueNode,
            location: this.getNodeLocation(declarator)
          });
        }
      }
    }
  }

  isAsync(node, sourceCode) {
    return node.children.some(child => child.type === 'async');
  }

  isGenerator(node, sourceCode) {
    return node.children.some(child => child.type === '*');
  }

  hasModifier(node, modifier) {
    return node.children.some(child => child.type === modifier);
  }

  extractRequireCall(node, sourceCode) {
    try {
      const fullText = this.getNodeText(node, sourceCode);
      
      // Simple regex check first
      if (!fullText.includes('require(')) {
        return null;
      }
      
      // Look for first child that says "require"
      let functionNode = null;
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (this.getNodeText(child, sourceCode) === 'require') {
          functionNode = child;
          break;
        }
      }
      
      if (!functionNode) {
        return null;
      }
      
      // Look for arguments node, then find string literals inside it
      let modulePath = null;
      
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        
        if (child.type === 'arguments') {
          // Look inside the arguments node for strings
          for (let j = 0; j < child.childCount; j++) {
            const argChild = child.child(j);
            const argText = this.getNodeText(argChild, sourceCode);
            
            // Look for string node types or quoted text
            if (argChild.type === 'string' || 
                ((argText.startsWith('"') && argText.endsWith('"')) ||
                 (argText.startsWith("'") && argText.endsWith("'")))) {
              modulePath = argText.slice(1, -1); // Remove quotes
              break;
            }
          }
          break;
        }
      }
      
      if (modulePath) {
        return {
          module: modulePath,
          type: 'require',
          imports: ['*'],
          location: this.getNodeLocation(node)
        };
      }
      
      return null;
      
    } catch (error) {
      console.log(`❌ Error in extractRequireCall: ${error.message}`);
      return null;
    }
  }

  static getSupportedExtensions() {
    return ['.js', '.jsx', '.mjs'];
  }

  static getLanguageName() {
    return 'javascript';
  }
}

module.exports = JavaScriptParser;