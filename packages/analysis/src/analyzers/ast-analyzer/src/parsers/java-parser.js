const BaseParser = require('./base-parser');

class JavaParser extends BaseParser {
  constructor() {
    const Java = require('tree-sitter-java');
    super('java', Java);
  }

  visitNode(node, sourceCode, structure) {
    switch (node.type) {
      case 'method_declaration':
      case 'constructor_declaration':
        structure.functions.push(this.extractFunctionSignature(node, sourceCode));
        break;
        
      case 'class_declaration':
      case 'interface_declaration':
      case 'enum_declaration':
        structure.classes.push(this.extractClassInfo(node, sourceCode));
        break;
        
      case 'import_declaration':
      case 'package_declaration':
        structure.imports.push(this.extractImportInfo(node, sourceCode));
        break;
        
      case 'field_declaration':
      case 'local_variable_declaration':
        this.extractVariables(node, sourceCode, structure);
        break;
    }
  }

  extractFunctionSignature(node, sourceCode) {
    let name = 'anonymous';
    let parameters = [];
    let returnType = null;
    
    // Find method components by traversing children
    let nameNode = null;
    let paramsNode = null;
    let typeNode = null;
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === 'identifier' && !nameNode) {
        nameNode = child;
      } else if (child.type === 'formal_parameters') {
        paramsNode = child;
      } else if (['type_identifier', 'void_type', 'boolean_type', 'integral_type', 'floating_point_type', 'generic_type'].includes(child.type)) {
        typeNode = child;
      }
    }
    
    if (nameNode) {
      name = this.getNodeText(nameNode, sourceCode);
    }
    
    // Extract parameters
    if (paramsNode) {
      parameters = this.extractParameters(paramsNode, sourceCode);
    }
    
    // Extract return type
    if (typeNode) {
      returnType = this.getNodeText(typeNode, sourceCode);
    } else if (node.type === 'constructor_declaration') {
      returnType = 'void'; // Constructors don't have explicit return types
    }
    
    // Calculate complexity
    const complexity = this.calculateFunctionComplexity(node, sourceCode);
    
    // Extract modifiers
    const modifiers = this.extractModifiers(node, sourceCode);
    
    return {
      name,
      parameters,
      returnType,
      location: this.getNodeLocation(node),
      complexity,
      type: node.type,
      modifiers,
      isConstructor: node.type === 'constructor_declaration',
      isStatic: modifiers.includes('static'),
      isPublic: modifiers.includes('public'),
      isPrivate: modifiers.includes('private'),
      isProtected: modifiers.includes('protected'),
      annotations: this.extractAnnotations(node, sourceCode)
    };
  }

  extractParameters(paramsNode, sourceCode) {
    const parameters = [];
    
    for (let i = 0; i < paramsNode.childCount; i++) {
      const param = paramsNode.child(i);
      
      if (param.type === 'formal_parameter') {
        let typeNode = null;
        let nameNode = null;
        
        // Find type and name nodes
        for (let j = 0; j < param.childCount; j++) {
          const child = param.child(j);
          if (['type_identifier', 'boolean_type', 'integral_type', 'floating_point_type', 'generic_type'].includes(child.type) && !typeNode) {
            typeNode = child;
          } else if (child.type === 'identifier' && !nameNode) {
            nameNode = child;
          }
        }
        
        parameters.push({
          name: nameNode ? this.getNodeText(nameNode, sourceCode) : 'unknown',
          type: typeNode ? this.getNodeText(typeNode, sourceCode) : 'Object',
          defaultValue: null, // Java doesn't have default parameters
          isFinal: this.hasModifier(param, 'final', sourceCode),
          annotations: this.extractAnnotations(param, sourceCode)
        });
      } else if (param.type === 'spread_parameter') {
        // Varargs parameter
        let typeNode = null;
        let nameNode = null;
        
        // Find type and name nodes
        for (let j = 0; j < param.childCount; j++) {
          const child = param.child(j);
          if (['type_identifier', 'boolean_type', 'integral_type', 'floating_point_type', 'generic_type'].includes(child.type) && !typeNode) {
            typeNode = child;
          } else if (child.type === 'identifier' && !nameNode) {
            nameNode = child;
          }
        }
        
        parameters.push({
          name: nameNode ? this.getNodeText(nameNode, sourceCode) : 'unknown',
          type: typeNode ? this.getNodeText(typeNode, sourceCode) + '...' : 'Object...',
          defaultValue: null,
          isVarargs: true,
          annotations: this.extractAnnotations(param, sourceCode)
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
        case 'enhanced_for_statement':
        case 'do_statement':
        case 'switch_expression':
        case 'switch_statement':
          branches++;
          cognitive += 1 + currentDepth;
          break;
          
        case 'ternary_expression':
        case 'binary_expression':
          // Only count logical operators - find the operator by traversing children
          for (let i = 0; i < currentNode.childCount; i++) {
            const child = currentNode.child(i);
            if (child.type === '&&' || child.type === '||') {
              branches++;
              cognitive += 1;
              break;
            }
          }
          break;
          
        case 'catch_clause':
          branches++;
          cognitive += 1;
          break;
          
        case 'lambda_expression':
          branches++;
          cognitive += 1;
          break;
      }
      
      const newDepth = ['if_statement', 'while_statement', 'for_statement', 'enhanced_for_statement', 'do_statement']
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
    let interfacesNode = null;
    
    // Find class components by traversing children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === 'identifier' && !nameNode) {
        nameNode = child;
      } else if (child.type === 'class_body' || child.type === 'interface_body' || child.type === 'enum_body') {
        bodyNode = child;
      } else if (child.type === 'superclass') {
        superclassNode = child;
      } else if (child.type === 'super_interfaces') {
        interfacesNode = child;
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
    
    // Extract interfaces
    if (interfacesNode) {
      for (let i = 0; i < interfacesNode.childCount; i++) {
        const interfaceNode = interfacesNode.child(i);
        if (interfaceNode.type === 'type_identifier') {
          inheritance.push({
            type: node.type === 'interface_declaration' ? 'extends' : 'implements',
            name: this.getNodeText(interfaceNode, sourceCode)
          });
        }
      }
    }
    
    // Extract class body
    if (bodyNode) {
      for (let i = 0; i < bodyNode.childCount; i++) {
        const member = bodyNode.child(i);
        
        if (member.type === 'method_declaration' || member.type === 'constructor_declaration') {
          methods.push(this.extractFunctionSignature(member, sourceCode));
        } else if (member.type === 'field_declaration') {
          const fieldProperties = this.extractFieldDeclaration(member, sourceCode);
          properties.push(...fieldProperties);
        } else if (member.type === 'class_declaration' || member.type === 'interface_declaration') {
          // Nested class/interface
          const nestedClass = this.extractClassInfo(member, sourceCode);
          nestedClass.isNested = true;
          structure.classes.push(nestedClass);
        }
      }
    }
    
    const modifiers = this.extractModifiers(node, sourceCode);
    
    return {
      name,
      methods,
      properties,
      inheritance,
      location: this.getNodeLocation(node),
      type: node.type,
      modifiers,
      isInterface: node.type === 'interface_declaration',
      isEnum: node.type === 'enum_declaration',
      isAbstract: modifiers.includes('abstract'),
      isFinal: modifiers.includes('final'),
      isStatic: modifiers.includes('static'),
      isPublic: modifiers.includes('public'),
      isPrivate: modifiers.includes('private'),
      isProtected: modifiers.includes('protected'),
      annotations: this.extractAnnotations(node, sourceCode)
    };
  }

  extractFieldDeclaration(node, sourceCode) {
    const properties = [];
    let typeNode = null;
    
    // Find the type node
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (['type_identifier', 'boolean_type', 'integral_type', 'floating_point_type', 'generic_type'].includes(child.type)) {
        typeNode = child;
        break;
      }
    }
    
    const modifiers = this.extractModifiers(node, sourceCode);
    
    // A field declaration can declare multiple variables
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === 'variable_declarator') {
        let nameNode = null;
        let valueNode = null;
        
        // Find name and value nodes
        for (let j = 0; j < child.childCount; j++) {
          const grandchild = child.child(j);
          if (grandchild.type === 'identifier' && !nameNode) {
            nameNode = grandchild;
          } else if (grandchild.type !== '=' && nameNode && !valueNode) {
            valueNode = grandchild;
          }
        }
        
        if (nameNode) {
          properties.push({
            name: this.getNodeText(nameNode, sourceCode),
            type: typeNode ? this.getNodeText(typeNode, sourceCode) : 'Object',
            hasInitializer: !!valueNode,
            modifiers,
            isStatic: modifiers.includes('static'),
            isFinal: modifiers.includes('final'),
            isPublic: modifiers.includes('public'),
            isPrivate: modifiers.includes('private'),
            isProtected: modifiers.includes('protected'),
            location: this.getNodeLocation(child),
            annotations: this.extractAnnotations(node, sourceCode)
          });
        }
      }
    }
    
    return properties;
  }

  extractImportInfo(node, sourceCode) {
    let module = 'unknown';
    const imports = [];
    
    if (node.type === 'import_declaration') {
      // Find the scoped_identifier or identifier node
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child.type === 'scoped_identifier' || child.type === 'identifier' || child.type === 'asterisk') {
          module = this.getNodeText(child, sourceCode);
          break;
        }
      }
      
      if (module !== 'unknown') {
        // Determine if it's a static import
        let isStatic = false;
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child.type === 'static') {
            isStatic = true;
            break;
          }
        }
        
        // Check if it's a wildcard import
        const isWildcard = module.includes('*') || module.endsWith('.*');
        
        imports.push({
          imported: isWildcard ? '*' : module.split('.').pop(),
          local: isWildcard ? '*' : module.split('.').pop(),
          type: isStatic ? 'static' : (isWildcard ? 'wildcard' : 'class'),
          fullPath: module
        });
      }
    } else if (node.type === 'package_declaration') {
      // Find the scoped_identifier or identifier for package
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child.type === 'scoped_identifier' || child.type === 'identifier') {
          module = this.getNodeText(child, sourceCode);
          imports.push({
            imported: 'package',
            local: module,
            type: 'package',
            fullPath: module
          });
          break;
        }
      }
    }
    
    return {
      module,
      imports,
      type: node.type,
      location: this.getNodeLocation(node)
    };
  }

  extractVariables(node, sourceCode, structure) {
    let typeNode = null;
    
    // Find the type node
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (['type_identifier', 'boolean_type', 'integral_type', 'floating_point_type', 'generic_type'].includes(child.type)) {
        typeNode = child;
        break;
      }
    }
    
    const modifiers = this.extractModifiers(node, sourceCode);
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === 'variable_declarator') {
        let nameNode = null;
        let valueNode = null;
        
        // Find name and value nodes
        for (let j = 0; j < child.childCount; j++) {
          const grandchild = child.child(j);
          if (grandchild.type === 'identifier' && !nameNode) {
            nameNode = grandchild;
          } else if (grandchild.type !== '=' && nameNode && !valueNode) {
            valueNode = grandchild;
          }
        }
        
        if (nameNode) {
          structure.variables.push({
            name: this.getNodeText(nameNode, sourceCode),
            type: typeNode ? this.getNodeText(typeNode, sourceCode) : 'Object',
            hasInitializer: !!valueNode,
            modifiers,
            isFinal: modifiers.includes('final'),
            location: this.getNodeLocation(child),
            scope: node.type === 'field_declaration' ? 'field' : 'local'
          });
        }
      }
    }
  }

  extractModifiers(node, sourceCode) {
    const modifiers = [];
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === 'modifiers') {
        for (let j = 0; j < child.childCount; j++) {
          const modifier = child.child(j);
          const modifierText = this.getNodeText(modifier, sourceCode);
          if (['public', 'private', 'protected', 'static', 'final', 'abstract', 'synchronized', 'native', 'transient', 'volatile'].includes(modifierText)) {
            modifiers.push(modifierText);
          }
        }
      }
    }
    
    return modifiers;
  }

  extractAnnotations(node, sourceCode) {
    const annotations = [];
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === 'annotation') {
        const nameNode = child.childForFieldName('name');
        if (nameNode) {
          annotations.push(this.getNodeText(nameNode, sourceCode));
        }
      } else if (child.type === 'modifiers') {
        // Annotations can also be found in modifiers
        for (let j = 0; j < child.childCount; j++) {
          const modifier = child.child(j);
          if (modifier.type === 'annotation') {
            const nameNode = modifier.childForFieldName('name');
            if (nameNode) {
              annotations.push(this.getNodeText(nameNode, sourceCode));
            }
          }
        }
      }
    }
    
    return annotations;
  }

  hasModifier(node, modifier, sourceCode) {
    const modifiers = this.extractModifiers(node, sourceCode);
    return modifiers.includes(modifier);
  }

  static getSupportedExtensions() {
    return ['.java'];
  }

  static getLanguageName() {
    return 'java';
  }
}

module.exports = JavaParser;