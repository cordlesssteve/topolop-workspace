class CommitParser {
  constructor() {
    this.patterns = {
      conventional: /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .+/,
      merge: /^Merge (branch|pull request)/,
      revert: /^Revert /,
      initial: /^(Initial commit|first commit)/i
    };
  }

  parseCommit(commit) {
    const analysis = {
      hash: commit.hash,
      shortHash: commit.shortHash,
      date: commit.date,
      author: commit.author,
      message: commit.message,
      type: this._classifyCommitType(commit.message),
      scope: this._extractScope(commit.message),
      breaking: this._isBreaking(commit.message),
      stats: null // Will be populated by file analysis
    };

    return analysis;
  }

  parseCommitBatch(commits) {
    return commits.map(commit => this.parseCommit(commit));
  }

  analyzeCommitPatterns(commits) {
    const analysis = {
      total: commits.length,
      types: {},
      authors: {},
      timeDistribution: {},
      averageMessageLength: 0,
      conventionalCommits: 0
    };

    let totalMessageLength = 0;

    commits.forEach(commit => {
      const parsed = this.parseCommit(commit);
      
      // Type distribution
      analysis.types[parsed.type] = (analysis.types[parsed.type] || 0) + 1;
      
      // Author distribution
      const authorKey = parsed.author.email;
      if (!analysis.authors[authorKey]) {
        analysis.authors[authorKey] = {
          name: parsed.author.name,
          email: parsed.author.email,
          commits: 0
        };
      }
      analysis.authors[authorKey].commits++;
      
      // Time distribution (by month)
      const monthKey = parsed.date.toISOString().substring(0, 7); // YYYY-MM
      analysis.timeDistribution[monthKey] = (analysis.timeDistribution[monthKey] || 0) + 1;
      
      // Message analysis
      totalMessageLength += parsed.message.length;
      if (this.patterns.conventional.test(parsed.message)) {
        analysis.conventionalCommits++;
      }
    });

    analysis.averageMessageLength = Math.round(totalMessageLength / commits.length);
    
    return analysis;
  }

  identifyHotspots(commits, changedFilesMap) {
    const fileStats = {};
    
    commits.forEach(commit => {
      const files = changedFilesMap[commit.hash] || [];
      
      files.forEach(file => {
        if (!fileStats[file.path]) {
          fileStats[file.path] = {
            path: file.path,
            commits: 0,
            authors: new Set(),
            lastModified: null,
            statuses: { added: 0, modified: 0, deleted: 0, renamed: 0 }
          };
        }
        
        const stats = fileStats[file.path];
        stats.commits++;
        stats.authors.add(commit.author.email);
        stats.statuses[file.status]++;
        
        if (!stats.lastModified || commit.date > stats.lastModified) {
          stats.lastModified = commit.date;
        }
      });
    });

    // Convert Set to count and sort by activity
    const hotspots = Object.values(fileStats)
      .map(stats => ({
        ...stats,
        authorCount: stats.authors.size,
        authors: undefined // Remove Set object
      }))
      .sort((a, b) => b.commits - a.commits);

    return hotspots;
  }

  identifyCoChangePatterns(commits, changedFilesMap) {
    const coChangeMatrix = {};
    
    commits.forEach(commit => {
      const files = changedFilesMap[commit.hash] || [];
      
      // For each pair of files changed together
      for (let i = 0; i < files.length; i++) {
        for (let j = i + 1; j < files.length; j++) {
          const file1 = files[i].path;
          const file2 = files[j].path;
          
          const key = [file1, file2].sort().join('::');
          
          if (!coChangeMatrix[key]) {
            coChangeMatrix[key] = {
              file1: file1 < file2 ? file1 : file2,
              file2: file1 < file2 ? file2 : file1,
              frequency: 0,
              commits: []
            };
          }
          
          coChangeMatrix[key].frequency++;
          coChangeMatrix[key].commits.push(commit.hash);
        }
      }
    });

    // Return pairs sorted by frequency
    return Object.values(coChangeMatrix)
      .filter(pair => pair.frequency > 1) // Only pairs that changed together more than once
      .sort((a, b) => b.frequency - a.frequency);
  }

  _classifyCommitType(message) {
    if (this.patterns.merge.test(message)) return 'merge';
    if (this.patterns.revert.test(message)) return 'revert';
    if (this.patterns.initial.test(message)) return 'initial';
    
    const conventionalMatch = message.match(/^(feat|fix|docs|style|refactor|test|chore)/);
    if (conventionalMatch) return conventionalMatch[1];
    
    return 'other';
  }

  _extractScope(message) {
    const scopeMatch = message.match(/^\w+\(([^)]+)\):/);
    return scopeMatch ? scopeMatch[1] : null;
  }

  _isBreaking(message) {
    return message.includes('BREAKING CHANGE') || message.includes('!:');
  }
}

module.exports = CommitParser;