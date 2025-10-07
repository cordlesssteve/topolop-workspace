const GitReader = require('./git-reader');
const CommitParser = require('./commit-parser');
const FileTracker = require('./file-tracker');

class GitAnalyzer {
  constructor(repoPath) {
    this.gitReader = new GitReader(repoPath);
    this.commitParser = new CommitParser();
    this.fileTracker = new FileTracker();
  }

  async analyze(options = {}) {
    const defaultOptions = {
      maxCommits: 1000,
      includeFileHistory: true,
      analyzePhrases: true,
      analyzeArchitecture: true
    };

    const opts = { ...defaultOptions, ...options };

    try {
      console.log('🔍 Starting repository analysis...');
      
      // Basic repository information
      console.log('📊 Gathering repository info...');
      const repoInfo = await this.gitReader.getBasicInfo();
      
      // Get commit history
      console.log('📜 Analyzing commit history...');
      const commits = await this.gitReader.getCommitHistory({ 
        maxCount: opts.maxCommits 
      });
      
      // Parse commits for patterns
      const commitAnalysis = this.commitParser.analyzeCommitPatterns(commits);
      
      // Get current files
      console.log('📁 Analyzing file structure...');
      const currentFiles = await this.gitReader.getCurrentFiles();
      const fileStructure = this.fileTracker.analyzeFileStructure(currentFiles);
      
      let fileHistory = null;
      let hotspots = null;
      let coChangePatterns = null;
      let architecturalPatterns = null;
      
      if (opts.includeFileHistory) {
        console.log('🔥 Identifying change patterns...');
        
        // Get changed files for recent commits using optimized batch method
        const recentCommits = commits.slice(0, Math.min(100, commits.length));
        const commitHashes = recentCommits.map(c => c.hash);
        
        console.log(`   Analyzing ${recentCommits.length} recent commits for change patterns...`);
        
        // Use batch method instead of individual calls
        const changedFilesMap = await this.gitReader.getChangedFilesBatch(
          commitHashes, 
          (progress) => console.log(`   ${progress}`)
        );
        
        console.log('   Analyzing file evolution patterns...');
        // Analyze file evolution and patterns
        hotspots = this.commitParser.identifyHotspots(recentCommits, changedFilesMap);
        coChangePatterns = this.commitParser.identifyCoChangePatterns(recentCommits, changedFilesMap);
        fileHistory = this.fileTracker.trackFileEvolution(recentCommits, changedFilesMap);
      }
      
      if (opts.analyzeArchitecture) {
        console.log('🏗️  Analyzing architectural patterns...');
        architecturalPatterns = this.fileTracker.identifyArchitecturalPatterns(currentFiles);
      }

      console.log('✅ Analysis complete!');
      
      return {
        timestamp: new Date(),
        repository: repoInfo,
        commits: {
          total: commits.length,
          analysis: commitAnalysis,
          recent: commits.slice(0, 10) // Most recent commits
        },
        files: {
          structure: fileStructure,
          current: currentFiles.slice(0, 100), // Limit for output size
          history: fileHistory ? fileHistory.slice(0, 50) : null,
          hotspots: hotspots ? hotspots.slice(0, 20) : null
        },
        patterns: {
          coChanges: coChangePatterns ? coChangePatterns.slice(0, 20) : null,
          architecture: architecturalPatterns
        },
        metadata: {
          analysisOptions: opts,
          performanceStats: {
            commitsAnalyzed: commits.length,
            filesAnalyzed: currentFiles.length
          }
        }
      };
      
    } catch (error) {
      throw new Error(`Analysis failed: ${error.message}`);
    }
  }

  async quickAnalysis() {
    return this.analyze({
      maxCommits: 100,
      includeFileHistory: false,
      analyzePhrases: false,
      analyzeArchitecture: true
    });
  }

  async deepAnalysis() {
    return this.analyze({
      maxCommits: 5000,
      includeFileHistory: true,
      analyzePhrases: true,
      analyzeArchitecture: true
    });
  }
}

module.exports = {
  GitAnalyzer,
  GitReader,
  CommitParser,
  FileTracker
};