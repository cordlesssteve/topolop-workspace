const BaseParser = require('./base-parser');

class PythonParser extends BaseParser {
  constructor() {
    const Python = require('tree-sitter-python');
    super('python', Python);
  }

  visitNode(node, sourceCode, structure) {
    switch (node.type) {
      case 'function_definition':
      case 'async_function_definition':
        // Skip if parent is decorated_definition (will be handled by decorated_definition case)
        if (node.parent && node.parent.type === 'decorated_definition') {
          return;
        }
        // Skip if inside a class (will be handled by class extraction)
        if (this.isInsideClass(node)) {
          return;
        }
        const funcInfo = this.extractFunctionSignature(node, sourceCode);
        if (!this.isDuplicateFunction(funcInfo, structure.functions)) {
          structure.functions.push(funcInfo);
        }
        break;
        
      case 'class_definition':
        // Skip if parent is decorated_definition (will be handled by decorated_definition case)
        if (node.parent && node.parent.type === 'decorated_definition') {
          return;
        }
        const classInfo = this.extractClassInfo(node, sourceCode);
        if (!this.isDuplicateClass(classInfo, structure.classes)) {
          structure.classes.push(classInfo);
        }
        break;
        
      case 'import_statement':
      case 'import_from_statement':
        const importInfo = this.extractImportInfo(node, sourceCode);
        if (!this.isDuplicateImport(importInfo, structure.imports)) {
          structure.imports.push(importInfo);
        }
        break;
        
      case 'assignment':
      case 'augmented_assignment':
        this.extractVariables(node, sourceCode, structure);
        break;
        
      case 'decorated_definition':
        // Handle decorated classes/functions by processing their children
        // Skip if this is inside a class (will be handled by class extraction)
        if (this.isInsideClass(node)) {
          return;
        }
        
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child.type === 'class_definition') {
            const classInfo = this.extractClassInfo(child, sourceCode);
            if (!this.isDuplicateClass(classInfo, structure.classes)) {
              structure.classes.push(classInfo);
            }
          } else if (child.type === 'function_definition' || child.type === 'async_function_definition') {
            const funcInfo = this.extractFunctionSignature(child, sourceCode);
            if (!this.isDuplicateFunction(funcInfo, structure.functions)) {
              structure.functions.push(funcInfo);
            }
          }
        }
        break;
    }
  }

  isInsideClass(node) {
    let current = node.parent;
    while (current) {
      if (current.type === 'class_definition') {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  isDuplicateFunction(funcInfo, existingFunctions) {
    return existingFunctions.some(existing => 
      existing.name === funcInfo.name && 
      existing.location && funcInfo.location &&
      existing.location.start.line === funcInfo.location.start.line &&
      existing.location.start.column === funcInfo.location.start.column
    );
  }

  isDuplicateClass(classInfo, existingClasses) {
    return existingClasses.some(existing => 
      existing.name === classInfo.name && 
      existing.location && classInfo.location &&
      existing.location.start.line === classInfo.location.start.line &&
      existing.location.start.column === classInfo.location.start.column
    );
  }

  isDuplicateImport(importInfo, existingImports) {
    return existingImports.some(existing => 
      existing.module === importInfo.module &&
      existing.type === importInfo.type &&
      existing.location && importInfo.location &&
      existing.location.start.line === importInfo.location.start.line
    );
  }

  isDuplicateVariable(varInfo, existingVariables) {
    return existingVariables.some(existing => 
      existing.name === varInfo.name &&
      existing.scope === varInfo.scope &&
      existing.location && varInfo.location &&
      existing.location.start.line === varInfo.location.start.line &&
      existing.location.start.column === varInfo.location.start.column
    );
  }

  extractFunctionSignature(node, sourceCode) {
    let name = 'anonymous';
    let parameters = [];
    let returnType = null;
    
    // Find function components by traversing children
    let nameNode = null;
    let paramsNode = null;
    let returnTypeNode = null;
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === 'identifier' && !nameNode) {
        nameNode = child;
      } else if (child.type === 'parameters') {
        paramsNode = child;
      } else if (child.type === 'type') {
        returnTypeNode = child;
      }
    }
    
    if (nameNode) {
      name = this.getNodeText(nameNode, sourceCode);
    }
    
    // Extract parameters
    if (paramsNode) {
      parameters = this.extractParameters(paramsNode, sourceCode);
    }
    
    // Extract return type annotation
    if (returnTypeNode) {
      returnType = this.getNodeText(returnTypeNode, sourceCode);
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
      async: node.type === 'async_function_definition',
      decorator: this.extractDecorators(node, sourceCode)
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
      } else if (param.type === 'default_parameter') {
        // Parameter with default value
        const nameNode = param.childForFieldName('name');
        const valueNode = param.childForFieldName('value');
        
        parameters.push({
          name: nameNode ? this.getNodeText(nameNode, sourceCode) : 'unknown',
          type: null,
          defaultValue: valueNode ? this.getNodeText(valueNode, sourceCode) : null
        });
      } else if (param.type === 'typed_parameter') {
        // Type annotated parameter
        const nameNode = param.childForFieldName('name');
        const typeNode = param.childForFieldName('type');
        
        parameters.push({
          name: nameNode ? this.getNodeText(nameNode, sourceCode) : 'unknown',
          type: typeNode ? this.getNodeText(typeNode, sourceCode) : null,
          defaultValue: null
        });
      } else if (param.type === 'typed_default_parameter') {
        // Type annotated parameter with default value
        const nameNode = param.childForFieldName('name');
        const typeNode = param.childForFieldName('type');
        const valueNode = param.childForFieldName('value');
        
        parameters.push({
          name: nameNode ? this.getNodeText(nameNode, sourceCode) : 'unknown',
          type: typeNode ? this.getNodeText(typeNode, sourceCode) : null,
          defaultValue: valueNode ? this.getNodeText(valueNode, sourceCode) : null
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
        case 'with_statement':
        case 'try_statement':
          branches++;
          cognitive += 1 + currentDepth;
          break;
          
        case 'elif_clause':
        case 'else_clause':
        case 'except_clause':
        case 'finally_clause':
          branches++;
          cognitive += 1;
          break;
          
        case 'conditional_expression': // ternary operator
        case 'boolean_operator':
          branches++;
          cognitive += 1;
          break;
          
        case 'lambda':
          branches++;
          cognitive += 1;
          break;
      }
      
      const newDepth = ['if_statement', 'while_statement', 'for_statement', 'with_statement', 'try_statement']
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
    let superclassesNode = null;
    
    // Find class components by traversing children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === 'identifier' && !nameNode) {
        nameNode = child;
      } else if (child.type === 'block') {
        bodyNode = child;
      } else if (child.type === 'argument_list') {
        superclassesNode = child;
      }
    }
    
    const name = nameNode ? this.getNodeText(nameNode, sourceCode) : 'Anonymous';
    const methods = [];
    const properties = [];
    const inheritance = [];
    
    // Extract inheritance
    if (superclassesNode) {
      for (let i = 0; i < superclassesNode.childCount; i++) {
        const superclass = superclassesNode.child(i);
        if (superclass.type === 'identifier' || superclass.type === 'attribute') {
          inheritance.push({
            type: 'inherits',
            name: this.getNodeText(superclass, sourceCode)
          });
        }
      }
    }
    
    // Extract class body
    if (bodyNode) {
      for (let i = 0; i < bodyNode.childCount; i++) {
        const member = bodyNode.child(i);
        
        if (member.type === 'function_definition' || member.type === 'async_function_definition') {
          const method = this.extractFunctionSignature(member, sourceCode);
          method.isMethod = true;
          method.isStatic = this.hasDecorator(member, 'staticmethod', sourceCode);
          method.isClassMethod = this.hasDecorator(member, 'classmethod', sourceCode);
          method.isProperty = this.hasDecorator(member, 'property', sourceCode);
          methods.push(method);
        } else if (member.type === 'decorated_definition') {
          // Handle decorated methods
          for (let j = 0; j < member.childCount; j++) {
            const child = member.child(j);
            if (child.type === 'function_definition' || child.type === 'async_function_definition') {
              const method = this.extractFunctionSignature(child, sourceCode);
              method.isMethod = true;
              method.isStatic = this.hasDecorator(child, 'staticmethod', sourceCode);
              method.isClassMethod = this.hasDecorator(child, 'classmethod', sourceCode);
              method.isProperty = this.hasDecorator(child, 'property', sourceCode);
              methods.push(method);
            }
          }
        } else if (member.type === 'assignment') {
          const property = this.extractClassProperty(member, sourceCode);
          if (property) {
            properties.push(property);
          }
        }
      }
    }
    
    return {
      name,
      methods,
      properties,
      inheritance,
      location: this.getNodeLocation(node),
      decorators: this.extractDecorators(node, sourceCode)
    };
  }

  extractClassProperty(node, sourceCode) {
    const leftNode = node.childForFieldName('left');
    const rightNode = node.childForFieldName('right');
    
    if (leftNode && leftNode.type === 'identifier') {
      return {
        name: this.getNodeText(leftNode, sourceCode),
        hasInitializer: !!rightNode,
        location: this.getNodeLocation(node)
      };
    }
    
    return null;
  }

  extractImportInfo(node, sourceCode) {
    let module = 'unknown';
    const imports = [];
    
    if (node.type === 'import_statement') {
      // import module [as alias]
      // Find the dotted_name or identifier
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child.type === 'dotted_name' || child.type === 'identifier') {
          module = this.getNodeText(child, sourceCode);
          imports.push({
            imported: module,
            local: module,
            type: 'module'
          });
          break;
        }
      }
    } else if (node.type === 'import_from_statement') {
      // from module import name [as alias]
      let moduleFound = false;
      
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        
        if (child.type === 'dotted_name' || child.type === 'identifier') {
          if (!moduleFound) {
            module = this.getNodeText(child, sourceCode);
            moduleFound = true;
          } else {
            // This is what's being imported
            imports.push({
              imported: this.getNodeText(child, sourceCode),
              local: this.getNodeText(child, sourceCode),
              type: 'named'
            });
          }
        } else if (child.type === 'aliased_import') {
          // Handle "name as alias"
          let importedName = null;
          let aliasName = null;
          
          for (let j = 0; j < child.childCount; j++) {
            const grandchild = child.child(j);
            if (grandchild.type === 'identifier') {
              if (!importedName) {
                importedName = this.getNodeText(grandchild, sourceCode);
              } else {
                aliasName = this.getNodeText(grandchild, sourceCode);
              }
            }
          }
          
          imports.push({
            imported: importedName || 'unknown',
            local: aliasName || importedName || 'unknown',
            type: 'aliased'
          });
        } else if (child.type === 'wildcard_import') {
          imports.push({
            imported: '*',
            local: '*',
            type: 'wildcard'
          });
        }
      }
    }
    
    return {
      module,
      imports,
      type: node.type === 'import_from_statement' ? 'from' : 'import',
      location: this.getNodeLocation(node)
    };
  }

  extractVariables(node, sourceCode, structure) {
    // Find left and right sides of assignment
    let leftNode = null;
    let rightNode = null;
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === 'identifier' || child.type === 'pattern_list' || child.type === 'tuple_pattern') {
        if (!leftNode) {
          leftNode = child;
        }
      } else if (child.type !== '=' && child.type !== '+=' && child.type !== '-=' && !leftNode) {
        // Skip operators
      } else if (leftNode && !rightNode) {
        rightNode = child;
      }
    }
    
    if (leftNode) {
      this.extractVariableNames(leftNode, sourceCode, structure, !!rightNode);
    }
  }

  extractVariableNames(node, sourceCode, structure, hasInitializer) {
    if (node.type === 'identifier') {
      const varInfo = {
        name: this.getNodeText(node, sourceCode),
        type: 'dynamic',
        hasInitializer,
        scope: this.getCurrentScope(node),
        location: this.getNodeLocation(node)
      };
      
      if (!this.isDuplicateVariable(varInfo, structure.variables)) {
        structure.variables.push(varInfo);
      }
    } else if (node.type === 'pattern_list' || node.type === 'tuple_pattern') {
      // Multiple assignment: a, b = values
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        this.extractVariableNames(child, sourceCode, structure, hasInitializer);
      }
    }
  }

  getCurrentScope(node) {
    let current = node.parent;
    while (current) {
      if (current.type === 'function_definition' || current.type === 'async_function_definition') {
        return 'function';
      } else if (current.type === 'class_definition') {
        return 'class';
      }
      current = current.parent;
    }
    return 'global';
  }

  extractDecorators(node, sourceCode) {
    const decorators = [];
    
    // Look for decorator children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === 'decorator') {
        // Find the identifier within the decorator
        for (let j = 0; j < child.childCount; j++) {
          const grandchild = child.child(j);
          if (grandchild.type === 'identifier') {
            decorators.push(this.getNodeText(grandchild, sourceCode));
            break;
          }
        }
      }
    }
    
    // Check if this node is within a decorated_definition
    let current = node.parent;
    while (current) {
      if (current.type === 'decorated_definition') {
        for (let i = 0; i < current.childCount; i++) {
          const child = current.child(i);
          if (child.type === 'decorator') {
            // Find the identifier within the decorator
            for (let j = 0; j < child.childCount; j++) {
              const grandchild = child.child(j);
              if (grandchild.type === 'identifier') {
                decorators.push(this.getNodeText(grandchild, sourceCode));
                break;
              }
            }
          }
        }
        break;
      }
      current = current.parent;
    }
    
    return decorators;
  }

  hasDecorator(node, decoratorName, sourceCode) {
    const decorators = this.extractDecorators(node, sourceCode);
    return decorators.some(decorator => 
      decorator === decoratorName || decorator.endsWith(`.${decoratorName}`)
    );
  }

  static getSupportedExtensions() {
    return ['.py', '.pyx', '.pyi'];
  }

  static getLanguageName() {
    return 'python';
  }
}

module.exports = PythonParser;