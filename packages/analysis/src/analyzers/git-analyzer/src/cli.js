#!/usr/bin/env node

const { GitAnalyzer } = require('./index');
const fs = require('fs').promises;
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🏗️  Topolop Git Analyzer

Usage: node cli.js <repository-path> [options]

Options:
  --quick        Quick analysis (fewer commits, no file history)
  --deep         Deep analysis (more commits, full history)
  --output=FILE  Save results to JSON file
  --help         Show this help

Examples:
  node cli.js .                    # Analyze current directory
  node cli.js /path/to/repo --quick
  node cli.js . --output=analysis.json
    `);
    process.exit(0);
  }

  const repoPath = args[0];
  const options = {
    quick: args.includes('--quick'),
    deep: args.includes('--deep'),
    output: args.find(arg => arg.startsWith('--output='))?.split('=')[1]
  };

  if (args.includes('--help')) {
    console.log('Help content shown above');
    process.exit(0);
  }

  try {
    console.log(`🔍 Analyzing repository: ${path.resolve(repoPath)}`);
    console.log(`📊 Mode: ${options.quick ? 'Quick' : options.deep ? 'Deep' : 'Standard'}`);
    
    const analyzer = new GitAnalyzer(repoPath);
    
    let results;
    if (options.quick) {
      results = await analyzer.quickAnalysis();
    } else if (options.deep) {
      results = await analyzer.deepAnalysis();
    } else {
      results = await analyzer.analyze();
    }

    // Print summary to console
    console.log('\n📋 Analysis Summary:');
    console.log('══════════════════════');
    console.log(`Repository: ${results.repository.path}`);
    console.log(`Current Branch: ${results.repository.currentBranch}`);
    console.log(`Total Commits: ${results.commits.total}`);
    console.log(`Total Files: ${results.files.structure.total}`);
    console.log(`Code Files: ${results.files.structure.codeFiles}`);
    console.log(`Languages: ${Object.keys(results.files.structure.languages).join(', ')}`);
    
    if (results.patterns.architecture) {
      const patterns = Object.entries(results.patterns.architecture.patterns)
        .filter(([_, detected]) => detected)
        .map(([pattern, _]) => pattern);
      
      if (patterns.length > 0) {
        console.log(`Architecture: ${patterns.join(', ')}`);
      }
    }

    if (results.files.hotspots && results.files.hotspots.length > 0) {
      console.log('\n🔥 Top File Hotspots:');
      results.files.hotspots.slice(0, 5).forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.path} (${file.commits} commits, ${file.authorCount} authors)`);
      });
    }

    if (results.commits.analysis.types) {
      console.log('\n📊 Commit Types:');
      Object.entries(results.commits.analysis.types)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([type, count]) => {
          console.log(`  ${type}: ${count}`);
        });
    }

    // Save to file if requested
    if (options.output) {
      console.log(`\n💾 Saving results to ${options.output}...`);
      await fs.writeFile(options.output, JSON.stringify(results, null, 2));
      console.log('✅ Results saved!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}