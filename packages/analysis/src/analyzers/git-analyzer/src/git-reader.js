const simpleGit = require('simple-git');
const path = require('path');

class GitReader {
  constructor(repoPath) {
    this.repoPath = path.resolve(repoPath);
    this.git = simpleGit(this.repoPath);
  }

  async validateRepository() {
    try {
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new Error(`Path ${this.repoPath} is not a git repository`);
      }
      return true;
    } catch (error) {
      throw new Error(`Failed to validate repository: ${error.message}`);
    }
  }

  async getBasicInfo() {
    await this.validateRepository();
    
    const status = await this.git.status();
    const branches = await this.git.branch();
    const remotes = await this.git.getRemotes(true);
    
    return {
      path: this.repoPath,
      currentBranch: branches.current,
      branches: branches.all,
      remotes: remotes.map(r => ({ name: r.name, url: r.refs.fetch })),
      status: {
        ahead: status.ahead,
        behind: status.behind,
        files: status.files.length,
        staged: status.staged.length,
        modified: status.modified.length
      }
    };
  }

  async getCommitHistory(options = {}) {
    const defaultOptions = {
      maxCount: 1000,
      from: null,
      to: null
    };

    const opts = { ...defaultOptions, ...options };
    
    try {
      const logOptions = {
        maxCount: opts.maxCount
      };
      
      if (opts.from) {
        logOptions.from = opts.from;
      }
      if (opts.to && opts.to !== 'HEAD') {
        logOptions.to = opts.to;
      }
      
      const log = await this.git.log(logOptions);

      return log.all.map(commit => ({
        hash: commit.hash,
        shortHash: commit.hash.substring(0, 8),
        date: new Date(commit.date),
        message: commit.message,
        author: {
          name: commit.author_name,
          email: commit.author_email
        }
      }));
    } catch (error) {
      throw new Error(`Failed to get commit history: ${error.message}`);
    }
  }

  async getFileHistory(filePath, options = {}) {
    const defaultOptions = {
      maxCount: 100,
      follow: true
    };

    const opts = { ...defaultOptions, ...options };

    try {
      const log = await this.git.log({
        file: filePath,
        maxCount: opts.maxCount,
        follow: opts.follow
      });

      return log.all.map(commit => ({
        hash: commit.hash,
        shortHash: commit.hash.substring(0, 8),
        date: new Date(commit.date),
        message: commit.message,
        author: {
          name: commit.author_name,
          email: commit.author_email
        }
      }));
    } catch (error) {
      throw new Error(`Failed to get file history for ${filePath}: ${error.message}`);
    }
  }

  async getChangedFiles(commitHash) {
    try {
      // Check if this is the first commit (no parent)
      const parents = await this.git.raw(['rev-list', '--parents', '-n', '1', commitHash]);
      const isFirstCommit = parents.trim().split(' ').length === 1;
      
      let diff;
      if (isFirstCommit) {
        // For first commit, show all files as added
        diff = await this.git.diff(['--name-status', '--root', commitHash]);
      } else {
        // Normal diff with parent
        diff = await this.git.diff(['--name-status', `${commitHash}^`, commitHash]);
      }
      
      return diff.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const parts = line.split('\t');
          const status = parts[0];
          const filePath = parts[1];
          
          return {
            status: this._mapGitStatus(status),
            path: filePath,
            statusCode: status
          };
        });
    } catch (error) {
      throw new Error(`Failed to get changed files for commit ${commitHash}: ${error.message}`);
    }
  }

  async getCurrentFiles() {
    try {
      const files = await this.git.raw(['ls-tree', '-r', '--name-only', 'HEAD']);
      return files.split('\n').filter(file => file.trim());
    } catch (error) {
      throw new Error(`Failed to get current files: ${error.message}`);
    }
  }

  /**
   * Batch method to get changed files for multiple commits efficiently
   * This avoids individual git calls per commit which causes timeouts
   */
  async getChangedFilesBatch(commitHashes, onProgress = null) {
    if (!commitHashes || commitHashes.length === 0) {
      return {};
    }

    try {
      const results = {};
      const batchSize = 10; // Process commits in batches to avoid memory issues
      
      console.log(`   Processing ${commitHashes.length} commits in batches of ${batchSize}...`);
      
      for (let i = 0; i < commitHashes.length; i += batchSize) {
        const batch = commitHashes.slice(i, i + batchSize);
        
        if (onProgress) {
          onProgress(`Processing commits ${i + 1}-${Math.min(i + batchSize, commitHashes.length)} of ${commitHashes.length}`);
        }
        
        // Use git log with --name-status to get all changed files in one call
        const logArgs = [
          'log',
          '--name-status', 
          '--format=COMMIT:%H', // Mark each commit clearly
          '--no-merges',
          ...batch
        ];
        
        const logOutput = await this.git.raw(logArgs);
        
        // Parse the batch output
        this._parseBatchChangedFiles(logOutput, results);
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      return results;
    } catch (error) {
      throw new Error(`Failed to get changed files batch: ${error.message}`);
    }
  }

  /**
   * Parse the batch output from git log --name-status
   */
  _parseBatchChangedFiles(logOutput, results) {
    const lines = logOutput.split('\n');
    let currentCommit = null;
    
    for (const line of lines) {
      if (line.startsWith('COMMIT:')) {
        currentCommit = line.substring(7); // Remove 'COMMIT:' prefix
        results[currentCommit] = [];
      } else if (currentCommit && line.trim() && line.includes('\t')) {
        const parts = line.split('\t');
        const status = parts[0];
        const filePath = parts[1];
        
        if (filePath) {
          results[currentCommit].push({
            status: this._mapGitStatus(status),
            path: filePath,
            statusCode: status
          });
        }
      }
    }
  }

  async getFileContents(filePath, commitHash = 'HEAD') {
    try {
      const content = await this.git.show([`${commitHash}:${filePath}`]);
      return content;
    } catch (error) {
      throw new Error(`Failed to get file contents for ${filePath} at ${commitHash}: ${error.message}`);
    }
  }

  _mapGitStatus(statusCode) {
    const statusMap = {
      'A': 'added',
      'M': 'modified',
      'D': 'deleted',
      'R': 'renamed',
      'C': 'copied',
      'U': 'updated'
    };
    
    return statusMap[statusCode] || 'unknown';
  }
}

module.exports = GitReader;