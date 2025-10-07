const path = require('path');

class FileTracker {
  constructor() {
    this.supportedExtensions = new Set([
      '.js', '.jsx', '.ts', '.tsx',     // JavaScript/TypeScript
      '.py', '.pyw',                    // Python
      '.java', '.kt',                   // Java/Kotlin
      '.go',                            // Go
      '.rs',                            // Rust
      '.cpp', '.cc', '.cxx', '.c', '.h', '.hpp', // C/C++
      '.cs',                            // C#
      '.rb',                            // Ruby
      '.php',                           // PHP
      '.swift',                         // Swift
      '.scala',                         // Scala
      '.json', '.yaml', '.yml', '.xml', // Config files
      '.md', '.txt'                     // Documentation
    ]);
  }

  isCodeFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedExtensions.has(ext);
  }

  detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath);
    
    const languageMap = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.pyw': 'python',
      '.java': 'java',
      '.kt': 'kotlin',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.rb': 'ruby',
      '.php': 'php',
      '.swift': 'swift',
      '.scala': 'scala',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.md': 'markdown',
      '.txt': 'text'
    };

    // Special cases
    if (basename === 'package.json') return 'package-json';
    if (basename === 'Dockerfile') return 'docker';
    if (basename.startsWith('.env')) return 'env';
    if (basename === 'Makefile') return 'makefile';
    
    return languageMap[ext] || 'unknown';
  }

  categorizeFile(filePath) {
    const parts = filePath.split('/');
    const filename = parts[parts.length - 1];
    const language = this.detectLanguage(filePath);
    
    let category = 'source';
    
    // Test files
    if (parts.some(p => p.match(/test|spec|__tests__|\.test\.|\.spec\./))) {
      category = 'test';
    }
    // Configuration files
    else if (parts.some(p => p.match(/config|conf|settings/)) || 
             filename.match(/^(\.env|config\.|webpack\.|babel\.|eslint|prettier|tsconfig)/)) {
      category = 'config';
    }
    // Documentation
    else if (language === 'markdown' || filename.match(/README|CHANGELOG|LICENSE|CONTRIBUTING/i)) {
      category = 'docs';
    }
    // Build/tooling
    else if (parts.some(p => p.match(/build|dist|target|bin|scripts|tools/))) {
      category = 'build';
    }
    // Assets
    else if (filename.match(/\.(png|jpg|jpeg|gif|svg|ico|css|scss|less|woff|ttf)$/)) {
      category = 'asset';
    }
    // Dependencies
    else if (parts.some(p => p.match(/node_modules|vendor|lib|deps/))) {
      category = 'dependency';
    }

    return {
      path: filePath,
      filename,
      language,
      category,
      directory: path.dirname(filePath),
      extension: path.extname(filePath),
      isCodeFile: this.isCodeFile(filePath)
    };
  }

  analyzeFileStructure(files) {
    const analysis = {
      total: files.length,
      languages: {},
      categories: {},
      directories: {},
      extensions: {},
      codeFiles: 0,
      largestFiles: [],
      deepestPaths: []
    };

    files.forEach(filePath => {
      const fileInfo = this.categorizeFile(filePath);
      
      // Language distribution
      analysis.languages[fileInfo.language] = (analysis.languages[fileInfo.language] || 0) + 1;
      
      // Category distribution
      analysis.categories[fileInfo.category] = (analysis.categories[fileInfo.category] || 0) + 1;
      
      // Directory distribution
      const topLevelDir = fileInfo.path.split('/')[0] || 'root';
      analysis.directories[topLevelDir] = (analysis.directories[topLevelDir] || 0) + 1;
      
      // Extension distribution
      if (fileInfo.extension) {
        analysis.extensions[fileInfo.extension] = (analysis.extensions[fileInfo.extension] || 0) + 1;
      }
      
      if (fileInfo.isCodeFile) {
        analysis.codeFiles++;
      }
      
      // Track depth
      const depth = fileInfo.path.split('/').length;
      analysis.deepestPaths.push({ path: fileInfo.path, depth });
    });

    // Sort and limit deepest paths
    analysis.deepestPaths = analysis.deepestPaths
      .sort((a, b) => b.depth - a.depth)
      .slice(0, 10)
      .map(item => item.path);

    return analysis;
  }

  trackFileEvolution(commits, changedFilesMap) {
    const fileEvolution = {};
    
    commits.forEach(commit => {
      const files = changedFilesMap[commit.hash] || [];
      
      files.forEach(file => {
        if (!fileEvolution[file.path]) {
          fileEvolution[file.path] = {
            path: file.path,
            ...this.categorizeFile(file.path),
            timeline: [],
            created: null,
            deleted: null,
            totalChanges: 0,
            authors: new Set()
          };
        }
        
        const evolution = fileEvolution[file.path];
        evolution.timeline.push({
          commit: commit.hash,
          date: commit.date,
          author: commit.author.email,
          status: file.status,
          message: commit.message
        });
        
        evolution.totalChanges++;
        evolution.authors.add(commit.author.email);
        
        if (file.status === 'added' && !evolution.created) {
          evolution.created = commit.date;
        }
        
        if (file.status === 'deleted') {
          evolution.deleted = commit.date;
        }
      });
    });

    // Convert Sets to counts and sort timeline
    return Object.values(fileEvolution).map(evolution => ({
      ...evolution,
      authorCount: evolution.authors.size,
      authors: undefined, // Remove Set
      timeline: evolution.timeline.sort((a, b) => new Date(a.date) - new Date(b.date))
    }));
  }

  identifyArchitecturalPatterns(files) {
    const patterns = {
      mvc: false,
      layered: false,
      microservices: false,
      monorepo: false,
      frontend: false,
      backend: false,
      fullstack: false
    };

    const directories = new Set();
    const hasPackageJson = files.some(f => f.includes('package.json'));
    const hasDockerfile = files.some(f => f.includes('Dockerfile'));
    
    files.forEach(file => {
      const parts = file.split('/');
      if (parts.length > 1) {
        directories.add(parts[0]);
      }
    });

    // MVC pattern detection
    const mvcDirs = ['models', 'views', 'controllers'];
    if (mvcDirs.every(dir => directories.has(dir))) {
      patterns.mvc = true;
    }

    // Layered architecture
    const layeredDirs = ['src', 'lib', 'services', 'utils'];
    if (layeredDirs.some(dir => directories.has(dir))) {
      patterns.layered = true;
    }

    // Frontend indicators
    const frontendDirs = ['components', 'pages', 'public', 'assets'];
    const frontendFiles = files.some(f => f.includes('index.html') || f.includes('App.js'));
    if (frontendDirs.some(dir => directories.has(dir)) || frontendFiles) {
      patterns.frontend = true;
    }

    // Backend indicators
    const backendDirs = ['api', 'routes', 'middleware', 'database'];
    const backendFiles = files.some(f => f.includes('server.') || f.includes('app.'));
    if (backendDirs.some(dir => directories.has(dir)) || backendFiles) {
      patterns.backend = true;
    }

    // Microservices (multiple service directories)
    const serviceDirs = Array.from(directories).filter(dir => 
      dir.includes('service') || dir.endsWith('-api') || dir.endsWith('-srv')
    );
    if (serviceDirs.length > 1) {
      patterns.microservices = true;
    }

    // Monorepo (packages or apps directories)
    if (directories.has('packages') || directories.has('apps')) {
      patterns.monorepo = true;
    }

    patterns.fullstack = patterns.frontend && patterns.backend;

    return {
      patterns,
      directories: Array.from(directories),
      indicators: {
        hasPackageJson,
        hasDockerfile,
        totalDirectories: directories.size
      }
    };
  }
}

module.exports = FileTracker;