const fs = require('fs').promises;
const path = require('path');

/**
 * Manages incremental analysis state for git repositories
 * Tracks last analyzed commit to enable efficient delta analysis
 */
class AnalysisState {
  constructor(repoPath) {
    this.repoPath = path.resolve(repoPath);
    this.stateDir = path.join(this.repoPath, '.git', 'topolop');
    this.stateFile = path.join(this.stateDir, 'analysis-state.json');
  }

  /**
   * Initialize state directory if it doesn't exist
   */
  async initialize() {
    try {
      await fs.mkdir(this.stateDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to initialize state directory: ${error.message}`);
    }
  }

  /**
   * Load the current analysis state
   * @returns {Object|null} State object or null if no state exists
   */
  async load() {
    try {
      const data = await fs.readFile(this.stateFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // No state file exists yet
      }
      throw new Error(`Failed to load analysis state: ${error.message}`);
    }
  }

  /**
   * Save the current analysis state
   * @param {Object} state - State object to save
   */
  async save(state) {
    await this.initialize();

    const stateData = {
      ...state,
      lastUpdated: new Date().toISOString(),
      version: '1.0.0'
    };

    try {
      await fs.writeFile(
        this.stateFile,
        JSON.stringify(stateData, null, 2),
        'utf-8'
      );
    } catch (error) {
      throw new Error(`Failed to save analysis state: ${error.message}`);
    }
  }

  /**
   * Get the last analyzed commit hash
   * @returns {string|null} Commit hash or null if never analyzed
   */
  async getLastAnalyzedCommit() {
    const state = await this.load();
    return state?.lastAnalyzedCommit || null;
  }

  /**
   * Update the last analyzed commit hash
   * @param {string} commitHash - The commit hash to save
   * @param {Object} metadata - Additional metadata about the analysis
   */
  async updateLastAnalyzedCommit(commitHash, metadata = {}) {
    const currentState = await this.load() || {};

    await this.save({
      ...currentState,
      lastAnalyzedCommit: commitHash,
      lastAnalysisMetadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Get analysis statistics
   * @returns {Object} Statistics about analysis runs
   */
  async getStatistics() {
    const state = await this.load();
    if (!state) {
      return {
        totalAnalysisRuns: 0,
        lastAnalyzed: null,
        lastAnalyzedCommit: null
      };
    }

    return {
      totalAnalysisRuns: state.totalAnalysisRuns || 0,
      lastAnalyzed: state.lastUpdated,
      lastAnalyzedCommit: state.lastAnalyzedCommit,
      lastAnalysisMetadata: state.lastAnalysisMetadata
    };
  }

  /**
   * Increment analysis run counter
   */
  async incrementAnalysisCount() {
    const state = await this.load() || {};
    state.totalAnalysisRuns = (state.totalAnalysisRuns || 0) + 1;
    await this.save(state);
  }

  /**
   * Clear all state (force full re-analysis on next run)
   */
  async clear() {
    try {
      await fs.unlink(this.stateFile);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw new Error(`Failed to clear analysis state: ${error.message}`);
      }
    }
  }

  /**
   * Check if this is the first analysis run
   * @returns {boolean} True if no previous state exists
   */
  async isFirstRun() {
    const state = await this.load();
    return state === null;
  }
}

module.exports = AnalysisState;
