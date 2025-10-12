const GitReader = require('./git-reader');
const CommitParser = require('./commit-parser');
const FileTracker = require('./file-tracker');
const AnalysisState = require('./analysis-state');

class GitAnalyzer {
  constructor(repoPath) {
    this.gitReader = new GitReader(repoPath);
    this.commitParser = new CommitParser();
    this.fileTracker = new FileTracker();
    this.analysisState = new AnalysisState(repoPath);
  }

  async analyze(options = {}) {
    const defaultOptions = {
      maxCommits: 500,
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

  async quickAnalysis(options = {}) {
    const defaultQuickOptions = {
      maxCommits: 100,
      includeFileHistory: false,
      analyzePhrases: false,
      analyzeArchitecture: true
    };
    return this.analyze({ ...defaultQuickOptions, ...options });
  }

  async deepAnalysis(options = {}) {
    const defaultDeepOptions = {
      maxCommits: 2000,
      includeFileHistory: true,
      analyzePhrases: true,
      analyzeArchitecture: true
    };
    return this.analyze({ ...defaultDeepOptions, ...options });
  }

  /**
   * Perform incremental analysis - only analyze new commits since last run
   * @param {Object} options - Analysis options
   * @returns {Object} Analysis results for new commits only
   */
  async incrementalAnalysis(options = {}) {
    const defaultOptions = {
      includeFileHistory: true,
      analyzePhrases: true,
      analyzeArchitecture: true,
      forceFullAnalysis: false
    };

    const opts = { ...defaultOptions, ...options };

    try {
      console.log('🔄 Starting incremental analysis...');

      // Check if this is the first run
      const isFirstRun = await this.analysisState.isFirstRun();
      if (isFirstRun || opts.forceFullAnalysis) {
        console.log('   First run or forced full analysis - performing complete analysis');
        const result = await this.analyze({
          maxCommits: 500,
          includeFileHistory: opts.includeFileHistory,
          analyzePhrases: opts.analyzePhrases,
          analyzeArchitecture: opts.analyzeArchitecture
        });

        // Save state after first analysis
        const latestCommit = await this.gitReader.getLatestCommitHash();
        await this.analysisState.updateLastAnalyzedCommit(latestCommit, {
          commitsAnalyzed: result.commits.total,
          filesAnalyzed: result.files.current.length
        });
        await this.analysisState.incrementAnalysisCount();

        return {
          ...result,
          incremental: {
            isIncremental: false,
            reason: isFirstRun ? 'first_run' : 'forced_full_analysis',
            newCommitsCount: result.commits.total
          }
        };
      }

      // Get last analyzed commit
      const lastAnalyzedCommit = await this.analysisState.getLastAnalyzedCommit();
      console.log(`   Last analyzed commit: ${lastAnalyzedCommit.substring(0, 8)}`);

      // Verify the commit still exists (repo wasn't force-pushed)
      const commitExists = await this.gitReader.commitExists(lastAnalyzedCommit);
      if (!commitExists) {
        console.log('   ⚠️  Last analyzed commit no longer exists - performing full analysis');
        await this.analysisState.clear();
        return this.incrementalAnalysis({ ...opts, forceFullAnalysis: true });
      }

      // Get new commits since last analysis
      const newCommits = await this.gitReader.getCommitsSince(lastAnalyzedCommit);

      if (newCommits.length === 0) {
        console.log('   ✅ No new commits since last analysis');
        return {
          timestamp: new Date(),
          incremental: {
            isIncremental: true,
            newCommitsCount: 0,
            message: 'No new commits to analyze',
            lastAnalyzedCommit
          }
        };
      }

      console.log(`   📜 Found ${newCommits.length} new commits to analyze`);

      // Analyze only the new commits
      const repoInfo = await this.gitReader.getBasicInfo();
      const commitAnalysis = this.commitParser.analyzeCommitPatterns(newCommits);

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

        const commitHashes = newCommits.map(c => c.hash);
        const changedFilesMap = await this.gitReader.getChangedFilesBatch(
          commitHashes,
          (progress) => console.log(`   ${progress}`)
        );

        console.log('   Analyzing file evolution patterns...');
        hotspots = this.commitParser.identifyHotspots(newCommits, changedFilesMap);
        coChangePatterns = this.commitParser.identifyCoChangePatterns(newCommits, changedFilesMap);
        fileHistory = this.fileTracker.trackFileEvolution(newCommits, changedFilesMap);
      }

      if (opts.analyzeArchitecture) {
        console.log('🏗️  Analyzing architectural patterns...');
        architecturalPatterns = this.fileTracker.identifyArchitecturalPatterns(currentFiles);
      }

      // Update state with latest commit
      const latestCommit = await this.gitReader.getLatestCommitHash();
      await this.analysisState.updateLastAnalyzedCommit(latestCommit, {
        commitsAnalyzed: newCommits.length,
        filesAnalyzed: currentFiles.length,
        incrementalRun: true
      });
      await this.analysisState.incrementAnalysisCount();

      console.log('✅ Incremental analysis complete!');

      return {
        timestamp: new Date(),
        repository: repoInfo,
        commits: {
          total: newCommits.length,
          analysis: commitAnalysis,
          recent: newCommits.slice(0, 10)
        },
        files: {
          structure: fileStructure,
          current: currentFiles.slice(0, 100),
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
            commitsAnalyzed: newCommits.length,
            filesAnalyzed: currentFiles.length
          }
        },
        incremental: {
          isIncremental: true,
          newCommitsCount: newCommits.length,
          lastAnalyzedCommit,
          currentCommit: latestCommit
        }
      };

    } catch (error) {
      throw new Error(`Incremental analysis failed: ${error.message}`);
    }
  }

  /**
   * Get statistics about past analysis runs
   * @returns {Object} Analysis statistics
   */
  async getAnalysisStatistics() {
    return this.analysisState.getStatistics();
  }

  /**
   * Clear analysis state and force full re-analysis on next run
   */
  async clearAnalysisState() {
    await this.analysisState.clear();
    console.log('✅ Analysis state cleared - next run will be a full analysis');
  }
}

module.exports = {
  GitAnalyzer,
  GitReader,
  CommitParser,
  FileTracker
};