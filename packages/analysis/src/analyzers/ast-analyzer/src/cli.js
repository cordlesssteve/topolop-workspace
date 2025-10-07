#!/usr/bin/env node

const { ASTAnalyzer } = require('./index');
const fs = require('fs').promises;

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🔍 Topolop AST Analyzer

Usage: node cli.js <directory-path> [options]

Options:
  --output=FILE     Save results to JSON file
  --parallel        Process files in parallel (default: true)
  --recursive       Analyze subdirectories (default: true)
  --max-files=N     Maximum files to analyze (default: 1000)
  --help           Show this help

Examples:
  node cli.js .                           # Analyze current directory
  node cli.js ./src --output=ast.json     # Save analysis results
  node cli.js . --max-files=100           # Limit file count
    `);
    process.exit(0);
  }

  const directoryPath = args[0];
  const options = {
    output: args.find(arg => arg.startsWith('--output='))?.split('=')[1],
    parallel: !args.includes('--no-parallel'),
    recursive: !args.includes('--no-recursive'),
    maxFiles: parseInt(args.find(arg => arg.startsWith('--max-files='))?.split('=')[1]) || 1000
  };

  try {
    console.log('🔍 Starting AST Analysis');
    console.log('════════════════════════');
    console.log(`Directory: ${directoryPath}`);
    console.log(`Max Files: ${options.maxFiles}`);
    console.log(`Parallel: ${options.parallel ? 'Yes' : 'No'}`);
    console.log(`Recursive: ${options.recursive ? 'Yes' : 'No'}`);
    
    const analyzer = new ASTAnalyzer();
    console.log(`\n📋 Supported Extensions: ${analyzer.getSupportedExtensions().join(', ')}`);
    
    const startTime = Date.now();
    const results = await analyzer.analyzeDirectory(directoryPath, {
      recursive: options.recursive,
      maxFiles: options.maxFiles,
      parallel: options.parallel
    });

    const duration = Date.now() - startTime;

    // Display Results
    console.log('\n📊 Analysis Results');
    console.log('══════════════════');
    console.log(`Files Analyzed: ${results.summary.totalFiles}`);
    console.log(`Total Functions: ${results.summary.totalFunctions}`);
    console.log(`Total Classes: ${results.summary.totalClasses}`);
    console.log(`Total Lines: ${results.summary.totalLines}`);
    console.log(`Average Complexity: ${results.summary.averageComplexity.toFixed(2)}`);
    console.log(`Analysis Time: ${duration}ms`);

    if (results.errors.length > 0) {
      console.log(`\n⚠️  Parse Errors: ${results.errors.length}`);
      results.errors.slice(0, 5).forEach(error => {
        console.log(`  • ${error.filePath}: ${error.error}`);
      });
      if (results.errors.length > 5) {
        console.log(`  ... and ${results.errors.length - 5} more`);
      }
    }

    if (Object.keys(results.summary.languages).length > 0) {
      console.log('\n💻 Languages Found:');
      Object.entries(results.summary.languages)
        .sort(([,a], [,b]) => b.files - a.files)
        .forEach(([lang, stats]) => {
          console.log(`  ${lang}: ${stats.files} files, ${stats.functions} functions, ${stats.classes} classes`);
        });
    }

    console.log('\n📈 Complexity Distribution:');
    console.log(`  Low (< 10): ${results.summary.filesByComplexity.low} files`);
    console.log(`  Medium (10-25): ${results.summary.filesByComplexity.medium} files`);
    console.log(`  High (> 25): ${results.summary.filesByComplexity.high} files`);

    if (results.summary.mostComplexFiles.length > 0) {
      console.log('\n🔥 Most Complex Files:');
      results.summary.mostComplexFiles.slice(0, 5).forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.filePath} (complexity: ${file.complexity})`);
      });
    }

    // Save results if requested
    if (options.output) {
      console.log(`\n💾 Saving results to ${options.output}...`);
      await fs.writeFile(options.output, JSON.stringify(results, null, 2));
      console.log('✅ Results saved!');
    }

    console.log('\n🎉 AST Analysis Complete!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}