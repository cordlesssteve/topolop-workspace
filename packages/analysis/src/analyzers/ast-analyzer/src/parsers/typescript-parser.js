const JavaScriptParser = require('./javascript-parser');

class TypeScriptParser extends JavaScriptParser {
  constructor() {
    const TypeScript = require('tree-sitter-typescript').typescript;
    super();
    this.language = 'typescript';
    this.treeSitterLanguage = TypeScript;
  }

  visitNode(node, sourceCode, structure) {
    // Handle TypeScript-specific nodes first
    switch (node.type) {
      case 'interface_declaration':
        structure.classes.push(this.extractInterfaceInfo(node, sourceCode));
        break;
        
      case 'type_alias_declaration':
        structure.variables.push(this.extractTypeAlias(node, sourceCode));
        break;
        
      case 'enum_declaration':
        structure.classes.push(this.extractEnumInfo(node, sourceCode));
        break;
        
      case 'namespace_declaration':
      case 'module_declaration':
        structure.classes.push(this.extractNamespaceInfo(node, sourceCode));
        break;
        
      default:
        // Fall back to JavaScript parsing for common nodes
        super.visitNode(node, sourceCode, structure);
        break;
    }
  }

  extractFunctionSignature(node, sourceCode) {
    const signature = super.extractFunctionSignature(node, sourceCode);
    
    // Add TypeScript-specific information
    signature.returnType = this.extractReturnType(node, sourceCode);
    signature.isGeneric = this.hasTypeParameters(node);
    signature.visibility = this.extractVisibility(node);
    signature.isStatic = this.hasModifier(node, 'static');
    signature.isAbstract = this.hasModifier(node, 'abstract');
    signature.isReadonly = this.hasModifier(node, 'readonly');

    // Enhanced parameter extraction with types
    const paramsNode = node.childForFieldName('parameters');
    if (paramsNode) {
      signature.parameters = this.extractTypedParameters(paramsNode, sourceCode);
    }

    return signature;
  }

  extractTypedParameters(paramsNode, sourceCode) {
    const parameters = [];
    
    for (const param of paramsNode.children) {
      if (param.type === 'required_parameter' || param.type === 'optional_parameter') {
        const nameNode = param.childForFieldName('pattern');
        const typeNode = param.childForFieldName('type');
        const defaultNode = param.childForFieldName('value');
        
        parameters.push({
          name: nameNode ? this.getNodeText(nameNode, sourceCode) : 'unknown',
          type: typeNode ? this.getNodeText(typeNode, sourceCode) : null,
          optional: param.type === 'optional_parameter',
          defaultValue: defaultNode ? this.getNodeText(defaultNode, sourceCode) : null
        });
      } else if (param.type === 'rest_parameter') {
        const nameNode = param.childForFieldName('pattern');
        const typeNode = param.childForFieldName('type');
        
        parameters.push({
          name: nameNode ? this.getNodeText(nameNode, sourceCode) : 'unknown',
          type: typeNode ? this.getNodeText(typeNode, sourceCode) : null,
          isRest: true,
          optional: false,
          defaultValue: null
        });
      }
    }
    
    return parameters;
  }

  extractInterfaceInfo(node, sourceCode) {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(nameNode, sourceCode) : 'Anonymous';
    
    const methods = [];
    const properties = [];
    const inheritance = [];
    
    // Extract heritage (extends/implements)
    const heritageNode = node.childForFieldName('heritage');
    if (heritageNode) {
      for (const clause of heritageNode.children) {
        if (clause.type === 'extends_clause') {
          const extendsTypes = this.extractHeritageTypes(clause, sourceCode);
          extendsTypes.forEach(type => {
            inheritance.push({
              type: 'extends',
              name: type
            });
          });
        }
      }
    }
    
    // Extract interface body
    const bodyNode = node.childForFieldName('body');
    if (bodyNode) {
      for (const member of bodyNode.children) {
        switch (member.type) {
          case 'method_signature':
            methods.push(this.extractMethodSignature(member, sourceCode));
            break;
          case 'property_signature':
            properties.push(this.extractPropertySignature(member, sourceCode));
            break;
          case 'call_signature':
            methods.push(this.extractCallSignature(member, sourceCode));
            break;
        }
      }
    }
    
    return {
      name,
      type: 'interface',
      methods,
      properties,
      inheritance,
      location: this.getNodeLocation(node),
      isGeneric: this.hasTypeParameters(node)
    };
  }

  extractEnumInfo(node, sourceCode) {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(nameNode, sourceCode) : 'Anonymous';
    
    const members = [];
    const bodyNode = node.childForFieldName('body');
    
    if (bodyNode) {
      for (const member of bodyNode.children) {
        if (member.type === 'property_identifier') {
          const memberName = this.getNodeText(member, sourceCode);
          const valueNode = member.nextSibling;
          
          members.push({
            name: memberName,
            value: valueNode ? this.getNodeText(valueNode, sourceCode) : null,
            location: this.getNodeLocation(member)
          });
        }
      }
    }
    
    return {
      name,
      type: 'enum',
      members,
      properties: members,
      methods: [],
      inheritance: [],
      location: this.getNodeLocation(node)
    };
  }

  extractNamespaceInfo(node, sourceCode) {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(nameNode, sourceCode) : 'Anonymous';
    
    const methods = [];
    const properties = [];
    const nestedNamespaces = [];
    
    // Extract namespace body
    const bodyNode = node.childForFieldName('body');
    if (bodyNode) {
      for (const member of bodyNode.children) {
        switch (member.type) {
          case 'function_declaration':
            methods.push(this.extractFunctionSignature(member, sourceCode));
            break;
          case 'variable_declaration':
            const vars = [];
            this.extractVariables(member, sourceCode, { variables: vars });
            properties.push(...vars);
            break;
          case 'namespace_declaration':
            nestedNamespaces.push(this.extractNamespaceInfo(member, sourceCode));
            break;
        }
      }
    }
    
    return {
      name,
      type: 'namespace',
      methods,
      properties,
      nestedNamespaces,
      inheritance: [],
      location: this.getNodeLocation(node)
    };
  }

  extractTypeAlias(node, sourceCode) {
    const nameNode = node.childForFieldName('name');
    const typeNode = node.childForFieldName('value');
    
    return {
      name: nameNode ? this.getNodeText(nameNode, sourceCode) : 'unknown',
      type: 'type_alias',
      aliasType: typeNode ? this.getNodeText(typeNode, sourceCode) : null,
      isGeneric: this.hasTypeParameters(node),
      location: this.getNodeLocation(node)
    };
  }

  extractMethodSignature(node, sourceCode) {
    const nameNode = node.childForFieldName('name');
    const paramsNode = node.childForFieldName('parameters');
    const returnTypeNode = node.childForFieldName('type');
    
    return {
      name: nameNode ? this.getNodeText(nameNode, sourceCode) : 'unknown',
      parameters: paramsNode ? this.extractTypedParameters(paramsNode, sourceCode) : [],
      returnType: returnTypeNode ? this.getNodeText(returnTypeNode, sourceCode) : null,
      optional: this.hasModifier(node, '?'),
      visibility: this.extractVisibility(node),
      isStatic: this.hasModifier(node, 'static'),
      isAbstract: this.hasModifier(node, 'abstract'),
      location: this.getNodeLocation(node)
    };
  }

  extractPropertySignature(node, sourceCode) {
    const nameNode = node.childForFieldName('name');
    const typeNode = node.childForFieldName('type');
    
    return {
      name: nameNode ? this.getNodeText(nameNode, sourceCode) : 'unknown',
      type: typeNode ? this.getNodeText(typeNode, sourceCode) : null,
      optional: this.hasModifier(node, '?'),
      readonly: this.hasModifier(node, 'readonly'),
      visibility: this.extractVisibility(node),
      isStatic: this.hasModifier(node, 'static'),
      location: this.getNodeLocation(node)
    };
  }

  extractCallSignature(node, sourceCode) {
    const paramsNode = node.childForFieldName('parameters');
    const returnTypeNode = node.childForFieldName('type');
    
    return {
      name: '()',
      type: 'call_signature',
      parameters: paramsNode ? this.extractTypedParameters(paramsNode, sourceCode) : [],
      returnType: returnTypeNode ? this.getNodeText(returnTypeNode, sourceCode) : null,
      location: this.getNodeLocation(node)
    };
  }

  extractReturnType(node, sourceCode) {
    const returnTypeNode = node.childForFieldName('return_type');
    return returnTypeNode ? this.getNodeText(returnTypeNode, sourceCode) : null;
  }

  extractVisibility(node) {
    const modifiers = ['public', 'private', 'protected'];
    
    for (const child of node.children) {
      if (modifiers.includes(child.type)) {
        return child.type;
      }
    }
    
    return 'public'; // Default visibility
  }

  hasTypeParameters(node) {
    return node.children.some(child => child.type === 'type_parameters');
  }

  extractHeritageTypes(clause, sourceCode) {
    const types = [];
    
    for (const child of clause.children) {
      if (child.type === 'identifier' || child.type === 'member_expression') {
        types.push(this.getNodeText(child, sourceCode));
      }
    }
    
    return types;
  }

  static getSupportedExtensions() {
    return ['.ts', '.tsx'];
  }

  static getLanguageName() {
    return 'typescript';
  }
}

module.exports = TypeScriptParser;