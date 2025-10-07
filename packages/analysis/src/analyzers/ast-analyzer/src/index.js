const ASTAnalyzer = require('./analyzer');
const BaseParser = require('./parsers/base-parser');
const JavaScriptParser = require('./parsers/javascript-parser');
const TypeScriptParser = require('./parsers/typescript-parser');

module.exports = {
  ASTAnalyzer,
  BaseParser,
  JavaScriptParser,
  TypeScriptParser
};