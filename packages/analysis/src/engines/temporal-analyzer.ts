/**
 * Temporal Analysis and Git History Correlation
 *
 * Analyzes patterns over time using git history to identify trends,
 * regression patterns, and team performance insights.
 */

import { UnifiedIssue } from '@topolop/shared-types';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Temporal analysis result
 */
export interface TemporalAnalysis {
  commits: GitCommit[];
  fileHistory: FileHistory[];
  issueEvolution: IssueEvolution[];
  patterns: TemporalPattern[];
  trends: TemporalTrend[];
  authorMetrics: AuthorMetrics[];
  regressions: RegressionAnalysis[];
  predictions: PredictiveAnalysis[];
}

/**
 * Git commit information
 */
export interface GitCommit {
  hash: string;
  author: string;
  email: string;
  date: Date;
  message: string;
  filesChanged: string[];
  files: Array<{ path: string; linesAdded: number; linesDeleted: number }>;
  linesAdded: number;
  linesDeleted: number;
  issuesIntroduced?: UnifiedIssue[];
  issuesFixed?: UnifiedIssue[];
}

/**
 * File history tracking
 */
export interface FileHistory {
  filePath: string;
  commits: GitCommit[];
  changeFrequency: number;
  authors: string[];
  complexity: ComplexityEvolution[];
  issueHistory: IssueHistoryEntry[];
  riskScore: number;
  stabilityMetrics: StabilityMetrics;
}

/**
 * Issue evolution over time
 */
export interface IssueEvolution {
  issueId: string;
  ruleId: string;
  filePath: string;
  timeline: IssueTimelineEntry[];
  pattern: 'introduced' | 'recurring' | 'persistent' | 'fixed' | 'regression';
  frequency: number;
  avgLifespan: number; // Days until fixed
  regressionCount: number;
}

/**
 * Issue timeline entry
 */
export interface IssueTimelineEntry {
  date: Date;
  commit: string;
  action: 'introduced' | 'modified' | 'fixed' | 'regressed';
  author: string;
  context: string;
  severity: string;
}

/**
 * Issue history entry
 */
export interface IssueHistoryEntry {
  date: Date;
  commitHash: string;
  commitMessage: string;
  author: string;
  totalIssues: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  newIssues: number;
  fixedIssues: number;
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
}

/**
 * Complexity evolution
 */
export interface ComplexityEvolution {
  date: Date;
  commit: string;
  cyclomaticComplexity: number;
  linesOfCode: number;
  functionCount: number;
  classCount: number;
}

/**
 * Stability metrics
 */
export interface StabilityMetrics {
  churnRate: number;        // How often file changes
  defectDensity: number;    // Issues per 1000 lines
  fixRate: number;          // Issues fixed vs introduced ratio
  regressionRate: number;   // Rate of regression introductions
  authorChanges: number;    // Number of different authors
}

/**
 * Temporal pattern
 */
export interface TemporalPattern {
  id: string;
  type: 'hotspot_formation' | 'quality_degradation' | 'cyclic_regression' | 'author_correlation' | 'feature_coupling';
  confidence: number;
  description: string;
  files: string[];
  timeRange: {
    start: Date;
    end: Date;
  };
  evidence: PatternEvidence[];
  recommendations: string[];
}

/**
 * Pattern evidence
 */
export interface PatternEvidence {
  type: 'commit_frequency' | 'issue_correlation' | 'author_activity' | 'complexity_change';
  value: number;
  description: string;
  significance: number;
}

/**
 * Temporal trend
 */
export interface TemporalTrend {
  metric: 'issue_count' | 'complexity' | 'churn_rate' | 'fix_rate' | 'defect_density';
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  slope: number;
  confidence: number;
  timeRange: {
    start: Date;
    end: Date;
  };
  dataPoints: TrendDataPoint[];
  forecast: TrendForecast[];
}

/**
 * Trend data point
 */
export interface TrendDataPoint {
  date: Date;
  value: number;
  commit?: string;
}

/**
 * Trend forecast
 */
export interface TrendForecast {
  date: Date;
  predictedValue: number;
  confidence: number;
  upperBound: number;
  lowerBound: number;
}

/**
 * Author metrics and team analysis
 */
export interface AuthorMetrics {
  author: string;
  email: string;
  commits: number;
  linesAdded: number;
  linesDeleted: number;
  filesOwned: string[];
  specializations: string[];
  collaborators: string[];
  issueIntroductionRate: number;
  issueFixRate: number;
  codeQualityScore: number;
  experienceLevel: 'junior' | 'mid' | 'senior' | 'expert';
  workingPatterns: WorkingPattern[];
}

/**
 * Working pattern
 */
export interface WorkingPattern {
  type: 'daily_activity' | 'weekly_pattern' | 'commit_size' | 'file_focus';
  pattern: string;
  confidence: number;
  description?: string;
  frequency?: number;
  metadata?: any;
}

/**
 * Regression analysis
 */
export interface RegressionAnalysis {
  id: string;
  filePath: string;
  introducedCommit: string;
  commitDate: string;
  commitMessage: string;
  author: string;
  issuesIntroduced: number;
  riskFactors: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  relatedIssues: string[];
  type?: 'functional' | 'performance' | 'security' | 'quality';
  triggerCommit?: string;
  affectedFiles?: string[];
  regressionPattern?: string;
  rootCause?: string;
  impact?: RegressionImpact;
  prevention: string[];
}

/**
 * Regression impact
 */
export interface RegressionImpact {
  issuesIntroduced: number;
  filesAffected: number;
  complexityIncrease: number;
  testFailures: number;
  estimatedFixTime: number; // Hours
}

/**
 * Predictive analysis
 */
export interface PredictiveAnalysis {
  type: 'issue_prediction' | 'hotspot_prediction' | 'quality_forecast' | 'maintenance_prediction';
  timeHorizon: number; // Days
  confidence: number;
  predictions: Prediction[];
  riskFactors: RiskFactor[];
  recommendations: string[];
  metadata?: any;
}

/**
 * Individual prediction
 */
export interface Prediction {
  target: string; // File path or metric name
  currentValue: number;
  predictedValue: number;
  changePercentage: number;
  probability: number;
}

/**
 * Risk factor
 */
export interface RiskFactor {
  factor: string;
  weight: number;
  description: string;
  mitigation: string;
  impact?: number;
}

/**
 * Main temporal analyzer
 */
export class TemporalAnalyzer {
  private gitCache: Map<string, GitCommit[]> = new Map();

  /**
   * Perform comprehensive temporal analysis
   */
  public async analyzeTemporalPatterns(
    projectRoot: string,
    issues: UnifiedIssue[],
    timeRange?: { start: Date; end: Date }
  ): Promise<TemporalAnalysis> {

    // Get git history
    const commits = await this.getGitHistory(projectRoot, timeRange);

    // Analyze file history
    const fileHistory = await this.analyzeFileHistory(projectRoot, commits, issues);

    // Track issue evolution
    const issueEvolution = this.analyzeIssueEvolution(issues, commits);

    // Detect temporal patterns
    const patterns = this.detectTemporalPatterns(commits, fileHistory, issueEvolution);

    // Calculate trends
    const trends = this.calculateTemporalTrends(commits, fileHistory);

    // Analyze authors and team dynamics
    const authorMetrics = this.analyzeAuthorMetrics(commits, issues);

    // Detect regressions
    const regressions = this.analyzeRegressions(commits, issues);

    // Generate predictions
    const predictions = this.generatePredictiveAnalysis(trends, patterns, fileHistory);

    return {
      commits,
      fileHistory,
      issueEvolution,
      patterns,
      trends,
      authorMetrics,
      regressions,
      predictions
    };
  }

  /**
   * Get git commit history
   */
  private async getGitHistory(
    projectRoot: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<GitCommit[]> {
    const cacheKey = `${projectRoot}_${timeRange?.start?.toISOString()}_${timeRange?.end?.toISOString()}`;

    if (this.gitCache.has(cacheKey)) {
      return this.gitCache.get(cacheKey)!;
    }

    const commits: GitCommit[] = [];

    try {
      // Build git log command
      let gitCommand = 'git log --pretty=format:"%H|%an|%ae|%ad|%s" --date=iso --numstat';

      if (timeRange) {
        const since = timeRange.start.toISOString().split('T')[0];
        const until = timeRange.end.toISOString().split('T')[0];
        gitCommand += ` --since="${since}" --until="${until}"`;
      }

      const { stdout } = await execAsync(gitCommand, { cwd: projectRoot });

      if (!stdout.trim()) {
        return commits;
      }

      const commitBlocks = stdout.split('\n\n').filter(block => block.trim());

      for (const block of commitBlocks) {
        const lines = block.split('\n');
        const commitLine = lines[0];

        if (commitLine && commitLine.includes('|')) {
          const parts = commitLine.split('|');
          if (parts.length >= 5) {
            const [hash, author, email, date, message] = parts;

            const filesChanged: string[] = [];
            let linesAdded = 0;
            let linesDeleted = 0;

            // Parse file changes
            for (let i = 1; i < lines.length; i++) {
              const line = lines[i];
              if (line && line.includes('\t')) {
                const fileParts = line.split('\t');
                if (fileParts.length >= 3 && fileParts[2]) {
                  const added = parseInt(fileParts[0] || '0') || 0;
                  const deleted = parseInt(fileParts[1] || '0') || 0;
                  const fileName = fileParts[2];

                  linesAdded += added;
                  linesDeleted += deleted;
                  filesChanged.push(fileName);
                }
              }
            }

            const fileDetails = filesChanged.map(fileName => ({
              path: fileName,
              linesAdded: Math.floor(linesAdded / Math.max(1, filesChanged.length)), // Distribute evenly
              linesDeleted: Math.floor(linesDeleted / Math.max(1, filesChanged.length))
            }));

            commits.push({
              hash: hash?.trim() || '',
              author: author?.trim() || '',
              email: email?.trim() || '',
              date: new Date(date?.trim() || ''),
              message: message?.trim() || '',
              filesChanged,
              files: fileDetails,
              linesAdded,
              linesDeleted
            });
          }
        }
      }

      this.gitCache.set(cacheKey, commits);

    } catch (error) {
      console.warn('Failed to get git history:', error);
    }

    return commits;
  }

  /**
   * Analyze file history and stability
   */
  private async analyzeFileHistory(
    projectRoot: string,
    commits: GitCommit[],
    issues: UnifiedIssue[]
  ): Promise<FileHistory[]> {
    const fileHistoryMap = new Map<string, FileHistory>();

    // Group issues by file
    const issuesByFile = new Map<string, UnifiedIssue[]>();
    issues.forEach(issue => {
      const filePath = issue.entity.canonicalPath;
      if (!issuesByFile.has(filePath)) {
        issuesByFile.set(filePath, []);
      }
      issuesByFile.get(filePath)!.push(issue);
    });

    // Analyze each file
    const allFiles = new Set<string>();
    commits.forEach(commit => {
      commit.filesChanged.forEach(file => allFiles.add(file));
    });

    for (const filePath of allFiles) {
      const fileCommits = commits.filter(commit => commit.filesChanged.includes(filePath));
      const fileIssues = issuesByFile.get(filePath) || [];

      const history: FileHistory = {
        filePath,
        commits: fileCommits,
        changeFrequency: this.calculateChangeFrequency(fileCommits),
        authors: [...new Set(fileCommits.map(commit => commit.author))],
        complexity: await this.analyzeComplexityEvolution(projectRoot, filePath, fileCommits),
        issueHistory: this.buildIssueHistory(fileIssues, fileCommits),
        riskScore: 0,
        stabilityMetrics: {
          churnRate: 0,
          defectDensity: 0,
          fixRate: 0,
          regressionRate: 0,
          authorChanges: 0
        }
      };

      // Calculate stability metrics
      history.stabilityMetrics = this.calculateStabilityMetrics(history, fileIssues);
      history.riskScore = this.calculateRiskScore(history);

      fileHistoryMap.set(filePath, history);
    }

    return Array.from(fileHistoryMap.values());
  }

  /**
   * Analyze issue evolution over time
   */
  private analyzeIssueEvolution(issues: UnifiedIssue[], commits: GitCommit[]): IssueEvolution[] {
    const evolutionMap = new Map<string, IssueEvolution>();

    // Group issues by rule and file
    const issueGroups = new Map<string, UnifiedIssue[]>();
    issues.forEach(issue => {
      const key = `${issue.ruleId}_${issue.entity.canonicalPath}`;
      if (!issueGroups.has(key)) {
        issueGroups.set(key, []);
      }
      issueGroups.get(key)!.push(issue);
    });

    // Analyze each issue type's evolution
    for (const [key, groupIssues] of issueGroups) {
      const keyParts = key.split('_');
      if (keyParts.length >= 2) {
        const [ruleId, filePath] = keyParts;
        const fileCommits = commits.filter(commit => commit.filesChanged.includes(filePath || ''));

        const timeline = this.buildIssueTimeline(groupIssues, fileCommits);
        const pattern = this.determineIssuePattern(timeline);

        const evolution: IssueEvolution = {
          issueId: key,
          ruleId: ruleId || '',
          filePath: filePath || '',
          timeline,
          pattern,
          frequency: this.calculateIssueFrequency(timeline),
          avgLifespan: this.calculateAverageLifespan(timeline),
          regressionCount: this.countRegressions(timeline)
        };

        evolutionMap.set(key, evolution);
      }
    }

    return Array.from(evolutionMap.values());
  }

  /**
   * Detect temporal patterns
   */
  private detectTemporalPatterns(
    commits: GitCommit[],
    fileHistory: FileHistory[],
    issueEvolution: IssueEvolution[]
  ): TemporalPattern[] {
    const patterns: TemporalPattern[] = [];

    // Detect hotspot formation patterns
    const hotspotPatterns = this.detectHotspotFormation(fileHistory);
    patterns.push(...hotspotPatterns);

    // Detect quality degradation patterns
    const qualityPatterns = this.detectQualityDegradation(issueEvolution);
    patterns.push(...qualityPatterns);

    // Detect cyclic regression patterns
    const cyclicPatterns = this.detectCyclicRegressions(issueEvolution);
    patterns.push(...cyclicPatterns);

    // Detect author correlation patterns
    const authorPatterns = this.detectAuthorCorrelationPatterns(commits, issueEvolution);
    patterns.push(...authorPatterns);

    return patterns;
  }

  /**
   * Calculate temporal trends
   */
  private calculateTemporalTrends(commits: GitCommit[], fileHistory: FileHistory[]): TemporalTrend[] {
    const trends: TemporalTrend[] = [];

    // Issue count trend
    const issueCountTrend = this.calculateIssueCountTrend(fileHistory);
    if (issueCountTrend) trends.push(issueCountTrend);

    // Complexity trend
    const complexityTrend = this.calculateComplexityTrend(fileHistory);
    if (complexityTrend) trends.push(complexityTrend);

    // Churn rate trend
    const churnTrend = this.calculateChurnRateTrend(commits);
    if (churnTrend) trends.push(churnTrend);

    return trends;
  }

  /**
   * Analyze author metrics and team dynamics
   */
  private analyzeAuthorMetrics(commits: GitCommit[], issues: UnifiedIssue[]): AuthorMetrics[] {
    const authorMap = new Map<string, AuthorMetrics>();

    // Initialize author metrics
    commits.forEach(commit => {
      if (!authorMap.has(commit.author)) {
        authorMap.set(commit.author, {
          author: commit.author,
          email: commit.email,
          commits: 0,
          linesAdded: 0,
          linesDeleted: 0,
          filesOwned: [],
          specializations: [],
          collaborators: [],
          issueIntroductionRate: 0,
          issueFixRate: 0,
          codeQualityScore: 0,
          experienceLevel: 'junior',
          workingPatterns: []
        });
      }

      const metrics = authorMap.get(commit.author)!;
      metrics.commits++;
      metrics.linesAdded += commit.linesAdded;
      metrics.linesDeleted += commit.linesDeleted;
    });

    // Calculate additional metrics for each author
    for (const metrics of authorMap.values()) {
      metrics.filesOwned = this.identifyOwnedFiles(metrics.author, commits);
      metrics.specializations = this.identifySpecializations(metrics.author, commits);
      metrics.collaborators = this.identifyCollaborators(metrics.author, commits);
      metrics.codeQualityScore = this.calculateCodeQualityScore(metrics.author, issues);
      metrics.experienceLevel = this.determineExperienceLevel(metrics);
      metrics.workingPatterns = this.analyzeWorkingPatterns(metrics.author, commits);
    }

    return Array.from(authorMap.values());
  }

  /**
   * Analyze regressions
   */
  private analyzeRegressions(commits: GitCommit[], issues: UnifiedIssue[]): RegressionAnalysis[] {
    const regressions: RegressionAnalysis[] = [];

    // Group issues by file for analysis
    const issuesByFile = new Map<string, UnifiedIssue[]>();
    for (const issue of issues) {
      const filePath = issue.entity.canonicalPath;
      if (!issuesByFile.has(filePath)) {
        issuesByFile.set(filePath, []);
      }
      issuesByFile.get(filePath)!.push(issue);
    }

    // Analyze each file's commit history for potential regressions
    for (const [filePath, fileIssues] of issuesByFile) {
      const fileCommits = commits.filter(commit =>
        commit.files.some(file => file.path === filePath)
      ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (fileCommits.length < 2) continue; // Need at least 2 commits to detect regressions

      // Look for patterns where issues increase after periods of stability
      for (let i = 1; i < fileCommits.length; i++) {
        const prevCommit = fileCommits[i - 1];
        const currentCommit = fileCommits[i];

        if (!currentCommit || !prevCommit) continue;

        // Estimate issue introduction based on commit timing
        const issuesAfterCommit = fileIssues.filter(issue => {
          // Simple heuristic: assume issues are detected shortly after introduction
          const issueDetectedTime = new Date().getTime(); // Placeholder - would use actual detection time
          const commitTime = new Date(currentCommit.date).getTime();
          return issueDetectedTime >= commitTime;
        });

        // Detect regression: significant increase in issues after commit
        if (issuesAfterCommit.length > 2) { // Threshold for regression
          const riskFactors: string[] = [];

          // Analyze commit characteristics for risk factors
          const commitFile = currentCommit.files.find(f => f.path === filePath);
          if (commitFile) {
            if (commitFile.linesAdded > 50) riskFactors.push('Large code addition');
            if (commitFile.linesDeleted > 20) riskFactors.push('Significant code removal');
          }
          if (currentCommit.message.toLowerCase().includes('refactor')) riskFactors.push('Refactoring');
          if (currentCommit.message.toLowerCase().includes('fix')) riskFactors.push('Bug fix attempt');

          regressions.push({
            id: `regression-${filePath}-${currentCommit.hash.substring(0, 8)}`,
            filePath,
            introducedCommit: currentCommit.hash,
            commitDate: currentCommit.date.toISOString(),
            commitMessage: currentCommit.message,
            author: currentCommit.author,
            issuesIntroduced: issuesAfterCommit.length,
            riskFactors,
            severity: issuesAfterCommit.some(issue => issue.severity === 'critical') ? 'high' :
                     issuesAfterCommit.some(issue => issue.severity === 'high') ? 'medium' : 'low',
            relatedIssues: issuesAfterCommit.map(issue => issue.id),
            prevention: [
              'Add comprehensive test coverage before major changes',
              'Use feature flags for gradual rollouts',
              'Implement automated regression testing',
              'Perform code reviews with focus on risk areas'
            ]
          });
        }
      }
    }

    return regressions.sort((a, b) => b.issuesIntroduced - a.issuesIntroduced);
  }

  /**
   * Generate predictive analysis
   */
  private generatePredictiveAnalysis(
    trends: TemporalTrend[],
    patterns: TemporalPattern[],
    fileHistory: FileHistory[]
  ): PredictiveAnalysis[] {
    const predictions: PredictiveAnalysis[] = [];

    // Issue prediction based on trends
    const issuePrediction = this.generateIssuePrediction(trends, fileHistory);
    if (issuePrediction) predictions.push(issuePrediction);

    // Hotspot prediction based on patterns
    const hotspotPrediction = this.generateHotspotPrediction(patterns, fileHistory);
    if (hotspotPrediction) predictions.push(hotspotPrediction);

    return predictions;
  }

  // Helper methods (implementations would be quite extensive)...

  private calculateChangeFrequency(commits: GitCommit[]): number {
    if (commits.length === 0) return 0;

    const lastCommit = commits[commits.length - 1];
    if (!lastCommit?.date) return 0;

    const timeSpan = Math.max(1, (Date.now() - lastCommit.date.getTime()) / (1000 * 60 * 60 * 24));
    return commits.length / timeSpan;
  }

  private async analyzeComplexityEvolution(projectRoot: string, filePath: string, commits: GitCommit[]): Promise<ComplexityEvolution[]> {
    const evolution: ComplexityEvolution[] = [];
    
    // Sample commits for complexity analysis (every 10th commit to avoid performance issues)
    const sampleCommits = commits.filter((_, index) => index % 10 === 0);
    
    for (const commit of sampleCommits) {
      try {
        // Basic file size as complexity metric (lines of code)
        const fileContent = await this.getFileAtCommit(projectRoot, filePath, commit.hash);
        if (fileContent) {
          const lines = fileContent.split('\n').length;
          const cyclomaticComplexity = this.calculateBasicComplexity(fileContent);
          
          evolution.push({
            date: commit.date,
            commit: commit.hash,
            linesOfCode: lines,
            cyclomaticComplexity,
            functionCount: this.countFunctions(fileContent),
            classCount: this.countClasses(fileContent)
          });
        }
      } catch (error) {
        // Skip commits where file doesn't exist or can't be read
        continue;
      }
    }
    
    return evolution;
  }

  private async getFileAtCommit(projectRoot: string, filePath: string, commitHash: string): Promise<string | null> {
    try {
      // Use git show to get file content at specific commit
      const { execSync } = require('child_process');
      const content = execSync(`git show ${commitHash}:${filePath}`, { 
        cwd: projectRoot, 
        encoding: 'utf8' 
      });
      return content;
    } catch {
      return null;
    }
  }

  private calculateBasicComplexity(content: string): number {
    // Basic cyclomatic complexity calculation
    const complexityPatterns = [
      /\bif\b/g,
      /\belse\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\?\s*:/g, // ternary operators
      /&&/g,
      /\|\|/g
    ];
    
    let complexity = 1; // Base complexity
    for (const pattern of complexityPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }

  private countFunctions(content: string): number {
    const functionPatterns = [
      /function\s+\w+/g,
      /\w+\s*:\s*function/g,
      /\w+\s*=>\s*{/g,
      /^\s*\w+\s*\(/gm // Method definitions
    ];
    
    let count = 0;
    for (const pattern of functionPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        count += matches.length;
      }
    }
    return count;
  }

  private countClasses(content: string): number {
    const classMatches = content.match(/class\s+\w+/g);
    return classMatches ? classMatches.length : 0;
  }

  private buildIssueHistory(issues: UnifiedIssue[], commits: GitCommit[]): IssueHistoryEntry[] {
    // Sort commits chronologically
    const sortedCommits = commits.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (sortedCommits.length === 0) return [];

    const history: IssueHistoryEntry[] = [];

    // Create time windows based on commits
    for (let i = 0; i < sortedCommits.length; i++) {
      const commit = sortedCommits[i];
      if (!commit) continue;

      const commitTime = new Date(commit.date).getTime();
      const nextCommitTime = i < sortedCommits.length - 1
        ? new Date(sortedCommits[i + 1]?.date || new Date()).getTime()
        : Date.now();

      // Find issues likely introduced or fixed in this time window
      const windowIssues = issues.filter(issue => {
        const filePath = issue.entity.canonicalPath;

        // Check if this commit touched the file where the issue is located
        return commit.files.some(file =>
          file.path === filePath || file.path.endsWith(filePath.split('/').pop() || '')
        );
      });

      // Estimate which issues were likely introduced vs fixed
      let newIssues = 0;
      let fixedIssues = 0;
      let criticalCount = 0;
      let highCount = 0;
      let mediumCount = 0;
      let lowCount = 0;

      for (const issue of windowIssues) {
        // Heuristic: Issues from security/bug analysis tools likely introduced in this commit
        // Issues from quality tools might be pre-existing but detected
        if (commit.message.toLowerCase().includes('fix') ||
            commit.message.toLowerCase().includes('resolve') ||
            commit.message.toLowerCase().includes('patch')) {
          // Commit message suggests fixes
          if (issue.severity === 'critical' || issue.severity === 'high') {
            fixedIssues++;
          } else {
            newIssues++; // Minor issues might be side effects
          }
        } else {
          // Regular commit, issues likely introduced
          newIssues++;
        }

        // Count by severity
        switch (issue.severity) {
          case 'critical': criticalCount++; break;
          case 'high': highCount++; break;
          case 'medium': mediumCount++; break;
          case 'low': lowCount++; break;
          case 'info': lowCount++; break;
        }
      }

      // Only add entry if there were issues in this window
      if (windowIssues.length > 0) {
        history.push({
          date: commit.date,
          commitHash: commit.hash,
          commitMessage: commit.message,
          author: commit.author,
          newIssues,
          fixedIssues,
          totalIssues: windowIssues.length,
          criticalCount,
          highCount,
          mediumCount,
          lowCount,
          filesChanged: commit.files.length,
          linesAdded: commit.files.reduce((sum, file) => sum + (file.linesAdded || 0), 0),
          linesDeleted: commit.files.reduce((sum, file) => sum + (file.linesDeleted || 0), 0)
        });
      }
    }

    return history;
  }

  private calculateStabilityMetrics(history: FileHistory, issues: UnifiedIssue[]): StabilityMetrics {
    // Calculate actual fix rate based on issue history
    const fixRate = this.calculateActualFixRate(history.issueHistory);

    // Calculate actual regression rate based on issue patterns
    const regressionRate = this.calculateActualRegressionRate(history.issueHistory);

    return {
      churnRate: history.changeFrequency,
      defectDensity: issues.length / Math.max(1, history.commits.length),
      fixRate,
      regressionRate,
      authorChanges: history.authors.length
    };
  }

  private calculateRiskScore(history: FileHistory): number {
    const metrics = history.stabilityMetrics;
    return (metrics.churnRate * 0.3) + (metrics.defectDensity * 0.4) + (metrics.regressionRate * 0.3);
  }

  private buildIssueTimeline(issues: UnifiedIssue[], commits: GitCommit[]): IssueTimelineEntry[] {
    const timeline: IssueTimelineEntry[] = [];

    // Sort commits chronologically
    const sortedCommits = commits.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Track issue states across commits
    const issueStates = new Map<string, {
      firstSeen: Date;
      lastSeen: Date;
      status: 'active' | 'fixed';
      severity: string;
    }>();

    // Process each commit to build timeline
    for (const commit of sortedCommits) {
      const commitDate = new Date(commit.date);

      // Find issues that might be related to this commit
      const relatedIssues = issues.filter(issue => {
        const filePath = issue.entity.canonicalPath;
        return commit.files.some(file =>
          file.path === filePath || file.path.endsWith(filePath.split('/').pop() || '')
        );
      });

      for (const issue of relatedIssues) {
        const issueKey = `${issue.ruleId}-${issue.entity.canonicalPath}-${issue.line || 0}`;
        const previousState = issueStates.get(issueKey);

        let action: 'introduced' | 'modified' | 'fixed' | 'regressed' = 'introduced';

        if (previousState) {
          // Determine action based on commit message and previous state
          const messageWords = commit.message.toLowerCase();

          if (messageWords.includes('fix') || messageWords.includes('resolve') || messageWords.includes('patch')) {
            if (previousState.status === 'active') {
              action = 'fixed';
              previousState.status = 'fixed';
            } else {
              action = 'modified'; // Already fixed, maybe additional changes
            }
          } else if (previousState.status === 'fixed') {
            // Issue was fixed but appears again - regression
            action = 'regressed';
            previousState.status = 'active';
          } else {
            // Issue existed and still exists - modification
            action = 'modified';
          }

          previousState.lastSeen = commitDate;
        } else {
          // First time seeing this issue
          action = 'introduced';
          issueStates.set(issueKey, {
            firstSeen: commitDate,
            lastSeen: commitDate,
            status: 'active',
            severity: issue.severity
          });
        }

        // Add timeline entry
        timeline.push({
          date: commitDate,
          commit: commit.hash,
          action,
          author: commit.author,
          context: `${issue.analysisType} issue in ${issue.entity.canonicalPath}`,
          severity: issue.severity
        });
      }
    }

    // Sort timeline by date
    return timeline.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private determineIssuePattern(timeline: IssueTimelineEntry[]): IssueEvolution['pattern'] {
    if (timeline.length === 0) return 'introduced';

    // Count different action types
    const actionCounts = timeline.reduce((counts, entry) => {
      counts[entry.action] = (counts[entry.action] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const totalEntries = timeline.length;
    const regressedCount = actionCounts.regressed || 0;
    const fixedCount = actionCounts.fixed || 0;
    const introducedCount = actionCounts.introduced || 0;
    const modifiedCount = actionCounts.modified || 0;

    // Determine pattern based on timeline characteristics
    if (regressedCount > 0) {
      // Has regressions - check if it's recurring
      if (regressedCount >= 2 || (regressedCount === 1 && fixedCount >= 1)) {
        return 'recurring'; // Multiple regressions or regression after fix
      } else {
        return 'regression'; // Single regression
      }
    }

    if (fixedCount > 0) {
      // Has fixes - check if it's been resolved
      const lastEntry = timeline[timeline.length - 1];
      if (lastEntry && lastEntry.action === 'fixed') {
        return 'fixed'; // Ends with a fix
      } else {
        return 'persistent'; // Fixed but still active
      }
    }

    if (modifiedCount > introducedCount) {
      // Lots of modifications - persistent issue
      return 'persistent';
    }

    // Default - mostly introductions
    return 'introduced';
  }

  private calculateIssueFrequency(timeline: IssueTimelineEntry[]): number {
    return timeline.length;
  }

  private calculateAverageLifespan(timeline: IssueTimelineEntry[]): number {
    if (timeline.length === 0) return 0;

    // Find introduction and fix pairs
    const lifespans: number[] = [];
    let lastIntroduced: Date | null = null;

    for (const entry of timeline) {
      if (entry.action === 'introduced' || entry.action === 'regressed') {
        lastIntroduced = entry.date;
      } else if (entry.action === 'fixed' && lastIntroduced) {
        // Calculate lifespan in days
        const lifespanMs = entry.date.getTime() - lastIntroduced.getTime();
        const lifespanDays = lifespanMs / (1000 * 60 * 60 * 24);
        lifespans.push(lifespanDays);
        lastIntroduced = null; // Reset for next cycle
      }
    }

    if (lifespans.length === 0) {
      // No complete introduction-fix cycles, estimate based on timeline span
      if (timeline.length > 1) {
        const firstEntry = timeline[0];
        const lastEntry = timeline[timeline.length - 1];
        if (!firstEntry || !lastEntry) {
          return 0;
        }
        const totalSpanMs = lastEntry.date.getTime() - firstEntry.date.getTime();
        return totalSpanMs / (1000 * 60 * 60 * 24); // Return total span in days
      }
      return 0;
    }

    // Calculate average lifespan
    const totalLifespan = lifespans.reduce((sum, lifespan) => sum + lifespan, 0);
    return totalLifespan / lifespans.length;
  }

  private countRegressions(timeline: IssueTimelineEntry[]): number {
    return timeline.filter(entry => entry.action === 'regressed').length;
  }

  private detectHotspotFormation(fileHistory: FileHistory[]): TemporalPattern[] {
    const patterns: TemporalPattern[] = [];

    for (const history of fileHistory) {
      // Analyze issue count trend over time
      const issueHistory = history.issueHistory;
      if (issueHistory.length < 3) continue; // Need at least 3 data points

      // Calculate issue density trend (issues per commit)
      const densityTrend: Array<{ date: Date; density: number }> = [];

      for (let i = 0; i < issueHistory.length; i++) {
        const entry = issueHistory[i];
        if (!entry) continue;
        const density = entry.totalIssues / Math.max(1, entry.filesChanged);
        densityTrend.push({
          date: entry.date,
          density
        });
      }

      // Check for increasing trend (simple linear regression)
      const n = densityTrend.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

      for (let i = 0; i < n; i++) {
        const x = i; // Time index
        const y = densityTrend[i]?.density || 0;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
      }

      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      // Calculate correlation coefficient for trend strength
      const avgX = sumX / n;
      const avgY = sumY / n;
      let numerator = 0, denomX = 0, denomY = 0;

      for (let i = 0; i < n; i++) {
        const x = i;
        const y = densityTrend[i]?.density || 0;
        numerator += (x - avgX) * (y - avgY);
        denomX += (x - avgX) * (x - avgX);
        denomY += (y - avgY) * (y - avgY);
      }

      const correlation = numerator / Math.sqrt(denomX * denomY);

      // Detect hotspot formation: positive slope with strong correlation
      if (slope > 0.1 && correlation > 0.7) {
        const confidence = Math.min(0.95, correlation * 0.8);
        const severity: 'low' | 'medium' | 'high' =
          slope > 0.5 ? 'high' :
          slope > 0.3 ? 'medium' : 'low';

        patterns.push({
          id: `hotspot-formation-${history.filePath}`,
          type: 'hotspot_formation',
          confidence,
          description: `Hotspot formation detected in ${history.filePath} with increasing issue density (slope: ${slope.toFixed(3)})`,
          files: [history.filePath],
          timeRange: {
            start: densityTrend[0]?.date || new Date(),
            end: densityTrend[n - 1]?.date || new Date()
          },
          evidence: [
            {
              type: 'issue_correlation',
              value: correlation,
              description: `Strong correlation (${correlation.toFixed(2)}) between time and issue density`,
              significance: correlation
            },
            {
              type: 'complexity_change',
              value: slope,
              description: `Increasing trend with slope ${slope.toFixed(3)}`,
              significance: Math.abs(slope)
            }
          ],
          recommendations: [
            'Prioritize refactoring this file to reduce complexity',
            'Add comprehensive test coverage',
            'Consider breaking down into smaller modules',
            'Implement stricter code review for changes to this file'
          ]
        });
      }
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  private detectQualityDegradation(issueEvolution: IssueEvolution[]): TemporalPattern[] {
    const patterns: TemporalPattern[] = [];

    for (const evolution of issueEvolution) {
      const timeline = evolution.timeline;
      if (timeline.length < 4) continue; // Need sufficient data points

      // Group timeline entries by time windows (weekly)
      const weeklyBuckets = new Map<string, IssueTimelineEntry[]>();

      for (const entry of timeline) {
        const weekKey = this.getWeekKey(entry.date);
        if (!weeklyBuckets.has(weekKey)) {
          weeklyBuckets.set(weekKey, []);
        }
        weeklyBuckets.get(weekKey)!.push(entry);
      }

      // Calculate issue density per week
      const weeklyDensity: Array<{ week: string; density: number; date: Date }> = [];
      for (const [weekKey, entries] of weeklyBuckets) {
        const introducedCount = entries.filter(e => e.action === 'introduced' || e.action === 'regressed').length;
        const fixedCount = entries.filter(e => e.action === 'fixed').length;
        const netIssues = introducedCount - fixedCount;
        const density = Math.max(0, netIssues); // Only count net new issues

        weeklyDensity.push({
          week: weekKey,
          density,
          date: entries[0]?.date || new Date()
        });
      }

      if (weeklyDensity.length < 3) continue;

      // Sort by date
      weeklyDensity.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Calculate trend using simple moving average
      const windowSize = 3;
      const trends: number[] = [];

      for (let i = windowSize; i < weeklyDensity.length; i++) {
        const recentAvg = weeklyDensity.slice(i - windowSize, i)
          .reduce((sum, bucket) => sum + bucket.density, 0) / windowSize;
        const olderAvg = weeklyDensity.slice(Math.max(0, i - windowSize * 2), i - windowSize)
          .reduce((sum, bucket) => sum + bucket.density, 0) / Math.min(windowSize, i - windowSize);

        if (olderAvg > 0) {
          const trendRatio = recentAvg / olderAvg;
          trends.push(trendRatio);
        }
      }

      // Detect degradation: sustained increase in issue density
      const avgTrend = trends.reduce((sum, trend) => sum + trend, 0) / trends.length;
      const increasingTrends = trends.filter(trend => trend > 1.2).length;
      const significantIncrease = increasingTrends / trends.length;

      if (avgTrend > 1.3 && significantIncrease > 0.6) {
        const severity: 'low' | 'medium' | 'high' =
          avgTrend > 2.0 ? 'high' :
          avgTrend > 1.6 ? 'medium' : 'low';

        patterns.push({
          id: `quality-degradation-${evolution.issueId}`,
          type: 'quality_degradation',
          confidence: Math.min(0.9, significantIncrease),
          description: `Quality degradation detected in ${evolution.filePath} - increasing issue density over time`,
          files: [evolution.filePath],
          timeRange: {
            start: weeklyDensity[0]?.date || new Date(),
            end: weeklyDensity[weeklyDensity.length - 1]?.date || new Date()
          },
          evidence: [
            {
              type: 'issue_correlation',
              value: avgTrend,
              description: `Average trend multiplier: ${avgTrend.toFixed(2)}`,
              significance: Math.min(1, avgTrend / 2)
            },
            {
              type: 'complexity_change',
              value: significantIncrease,
              description: `${(significantIncrease * 100).toFixed(1)}% of periods show significant increase`,
              significance: significantIncrease
            }
          ],
          recommendations: [
            'Implement immediate code review for changes to this file',
            'Add automated testing to catch regressions early',
            'Consider technical debt reduction sprint',
            'Monitor for architectural violations'
          ]
        });
      }
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  private getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const week = Math.ceil((date.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  private detectCyclicRegressions(issueEvolution: IssueEvolution[]): TemporalPattern[] {
    const patterns: TemporalPattern[] = [];

    for (const evolution of issueEvolution) {
      const timeline = evolution.timeline;
      if (timeline.length < 6) continue; // Need enough events to detect cycles

      // Find fix-regression cycles
      const cycles: Array<{ fixDate: Date; regressionDate: Date; duration: number }> = [];
      let lastFix: Date | null = null;

      for (const entry of timeline) {
        if (entry.action === 'fixed') {
          lastFix = entry.date;
        } else if (entry.action === 'regressed' && lastFix) {
          const duration = entry.date.getTime() - lastFix.getTime();
          cycles.push({
            fixDate: lastFix,
            regressionDate: entry.date,
            duration: duration
          });
          lastFix = null; // Reset for next cycle
        }
      }

      if (cycles.length < 2) continue; // Need at least 2 cycles to detect pattern

      // Analyze cycle characteristics
      const durations = cycles.map(cycle => cycle.duration / (1000 * 60 * 60 * 24)); // Convert to days
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const durationStdDev = Math.sqrt(durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length);

      // Check for regular cycles (low standard deviation indicates regularity)
      const regularity = durationStdDev / avgDuration; // Coefficient of variation
      const isRegular = regularity < 0.5; // Less than 50% variation

      // Check for frequent cycles (short average duration)
      const isFrequent = avgDuration < 30; // Less than 30 days between fix and regression

      if (isRegular || isFrequent || cycles.length >= 3) {
        const severity: 'low' | 'medium' | 'high' =
          cycles.length >= 4 && isFrequent ? 'high' :
          cycles.length >= 3 || isFrequent ? 'medium' : 'low';

        const confidence = Math.min(0.9,
          (cycles.length / 5) * 0.6 + // More cycles = higher confidence
          (isRegular ? 0.3 : 0) + // Regular pattern = higher confidence
          (isFrequent ? 0.1 : 0) // Frequent cycles = slightly higher confidence
        );

        patterns.push({
          id: `cyclic-regression-${evolution.issueId}`,
          type: 'cyclic_regression',
          confidence,
          description: `Cyclical regression pattern detected in ${evolution.filePath} - ${cycles.length} fix-regression cycles`,
          files: [evolution.filePath],
          timeRange: {
            start: cycles[0]?.fixDate || new Date(),
            end: cycles[cycles.length - 1]?.regressionDate || new Date()
          },
          evidence: [
            {
              type: 'commit_frequency',
              value: cycles.length,
              description: `${cycles.length} complete fix-regression cycles detected`,
              significance: Math.min(1, cycles.length / 5)
            },
            {
              type: 'issue_correlation',
              value: avgDuration,
              description: `Average cycle duration: ${avgDuration.toFixed(1)} days`,
              significance: isFrequent ? 0.8 : 0.4
            }
          ],
          recommendations: [
            'Investigate root cause of recurring regressions',
            'Implement comprehensive regression test suite',
            'Consider architectural refactoring to break the cycle',
            'Add monitoring for early regression detection',
            'Review fix quality and thoroughness process'
          ]
        });
      }
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  private detectAuthorCorrelationPatterns(commits: GitCommit[], issueEvolution: IssueEvolution[]): TemporalPattern[] {
    const patterns: TemporalPattern[] = [];

    // Group commits by author
    const authorCommits = new Map<string, GitCommit[]>();
    for (const commit of commits) {
      if (!authorCommits.has(commit.author)) {
        authorCommits.set(commit.author, []);
      }
      authorCommits.get(commit.author)!.push(commit);
    }

    // Analyze each author's correlation with issues
    for (const [author, authorCommitList] of authorCommits) {
      if (authorCommitList.length < 3) continue; // Need sufficient commits

      // Find issues that occurred after this author's commits
      const authorIssueCorrelations: Array<{
        commit: GitCommit;
        relatedIssues: IssueEvolution[];
        timingScore: number;
      }> = [];

      for (const commit of authorCommitList) {
        const relatedIssues = issueEvolution.filter(evolution => {
          // Check if issue timeline has entries that correlate with this commit
          return evolution.timeline.some(entry => {
            // Issue introduced within 3 days of this author's commit
            const timeDiff = Math.abs(entry.date.getTime() - commit.date.getTime());
            const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
            return timeDiff <= threeDaysMs && entry.action === 'introduced';
          });
        });

        if (relatedIssues.length > 0) {
          // Calculate timing correlation score
          const avgTimeDiff = relatedIssues.reduce((sum, evolution) => {
            const relatedEntry = evolution.timeline.find(entry =>
              Math.abs(entry.date.getTime() - commit.date.getTime()) <= 3 * 24 * 60 * 60 * 1000
            );
            if (relatedEntry) {
              return sum + Math.abs(relatedEntry.date.getTime() - commit.date.getTime());
            }
            return sum;
          }, 0) / relatedIssues.length;

          const timingScore = 1 - (avgTimeDiff / (3 * 24 * 60 * 60 * 1000)); // 1 = same time, 0 = 3 days apart

          authorIssueCorrelations.push({
            commit,
            relatedIssues,
            timingScore
          });
        }
      }

      // Analyze patterns
      if (authorIssueCorrelations.length >= 2) {
        const totalIssues = authorIssueCorrelations.reduce((sum, corr) => sum + corr.relatedIssues.length, 0);
        const avgIssuesPerCommit = totalIssues / authorCommitList.length;
        const avgTimingScore = authorIssueCorrelations.reduce((sum, corr) => sum + corr.timingScore, 0) / authorIssueCorrelations.length;

        // Determine if this author has a concerning pattern
        const issueRate = totalIssues / authorCommitList.length;
        const isProblematic = issueRate > 1.5; // More than 1.5 issues per commit on average
        const hasGoodTiming = avgTimingScore > 0.7; // Issues appear close to commits

        if (isProblematic && hasGoodTiming) {
          const severity: 'low' | 'medium' | 'high' =
            issueRate > 3 ? 'high' :
            issueRate > 2 ? 'medium' : 'low';

          const confidence = Math.min(0.95,
            (authorIssueCorrelations.length / 10) * 0.4 + // More correlations = higher confidence
            avgTimingScore * 0.4 + // Better timing = higher confidence
            Math.min(1, issueRate / 3) * 0.2 // Higher issue rate = higher confidence (capped)
          );

          patterns.push({
            id: `author-correlation-${author.replace(/\s+/g, '-').toLowerCase()}`,
            type: 'author_correlation',
            confidence,
            description: `Author ${author} shows correlation with issue introduction - ${totalIssues} issues across ${authorCommitList.length} commits`,
            files: [], // Not file-specific - affects multiple files
            timeRange: {
              start: authorCommitList[0]?.date || new Date(),
              end: authorCommitList[authorCommitList.length - 1]?.date || new Date()
            },
            evidence: [
              {
                type: 'author_activity',
                value: issueRate,
                description: `Issue rate: ${issueRate.toFixed(2)} issues per commit`,
                significance: Math.min(1, issueRate / 3)
              },
              {
                type: 'commit_frequency',
                value: authorCommitList.length,
                description: `${authorCommitList.length} commits with ${authorIssueCorrelations.length} issue correlations`,
                significance: Math.min(1, authorIssueCorrelations.length / 10)
              }
            ],
            recommendations: [
              `Provide additional code review for ${author}'s commits`,
              'Consider pair programming or mentoring opportunities',
              'Review and strengthen testing practices',
              'Implement pre-commit hooks for quality checks',
              'Analyze specific types of issues being introduced'
            ]
          });
        }
      }
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  private calculateIssueCountTrend(fileHistory: FileHistory[]): TemporalTrend | null {
    if (fileHistory.length === 0) return null;

    // Aggregate issue counts across all files by time
    const aggregatedHistory = new Map<string, number>();

    for (const history of fileHistory) {
      for (const entry of history.issueHistory) {
        const timeKey = entry.date.toISOString().split('T')[0]; // Daily aggregation
        if (!timeKey) continue;
        const currentCount = aggregatedHistory.get(timeKey) || 0;
        aggregatedHistory.set(timeKey, currentCount + entry.totalIssues);
      }
    }

    if (aggregatedHistory.size < 3) return null;

    // Convert to sorted array
    const dataPoints = Array.from(aggregatedHistory.entries())
      .map(([date, count]) => ({ date: new Date(date), value: count }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate linear regression
    const n = dataPoints.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (let i = 0; i < n; i++) {
      const x = i; // Time index
      const y = dataPoints[i]?.value || 0;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const avgY = sumY / n;
    let ssTotal = 0, ssResidual = 0;

    for (let i = 0; i < n; i++) {
      const y = dataPoints[i]?.value || 0;
      const yPred = slope * i + intercept;
      ssTotal += (y - avgY) * (y - avgY);
      ssResidual += (y - yPred) * (y - yPred);
    }

    const rSquared = 1 - (ssResidual / ssTotal);

    // Determine trend direction and strength
    const direction: 'increasing' | 'decreasing' | 'stable' =
      Math.abs(slope) < 0.1 ? 'stable' :
      slope > 0 ? 'increasing' : 'decreasing';

    const strength: 'weak' | 'moderate' | 'strong' =
      rSquared < 0.3 ? 'weak' :
      rSquared < 0.7 ? 'moderate' : 'strong';

    return {
      metric: 'issue_count',
      direction,
      slope,
      confidence: rSquared,
      timeRange: {
        start: dataPoints[0]?.date || new Date(),
        end: dataPoints[n - 1]?.date || new Date()
      },
      dataPoints: dataPoints.map(dp => ({
        date: dp.date,
        value: dp.value
      })),
      forecast: this.generateForecast(dataPoints, 30) // 30-day forecast
    };
  }

  private calculateComplexityTrend(fileHistory: FileHistory[]): TemporalTrend | null {
    if (fileHistory.length === 0) return null;

    // Aggregate complexity metrics across all files by time
    const complexityData = new Map<string, { totalComplexity: number; fileCount: number }>();

    for (const history of fileHistory) {
      // Use complexity if available, otherwise estimate from commits
      if (history.complexity && history.complexity.length > 0) {
        for (const evolution of history.complexity) {
          const timeKey = evolution.date.toISOString().split('T')[0];
          if (!timeKey) continue;
          const existing = complexityData.get(timeKey) || { totalComplexity: 0, fileCount: 0 };
          complexityData.set(timeKey, {
            totalComplexity: existing.totalComplexity + evolution.cyclomaticComplexity,
            fileCount: existing.fileCount + 1
          });
        }
      } else {
        // Estimate complexity from commit activity and issue counts
        for (const entry of history.issueHistory) {
          const timeKey = entry.date.toISOString().split('T')[0];
          if (!timeKey) continue;
          // Heuristic: More issues + more lines changed = higher complexity
          const estimatedComplexity = (entry.totalIssues * 2) + (entry.linesAdded * 0.1) + (entry.linesDeleted * 0.05);
          const existing = complexityData.get(timeKey) || { totalComplexity: 0, fileCount: 0 };
          complexityData.set(timeKey, {
            totalComplexity: existing.totalComplexity + estimatedComplexity,
            fileCount: existing.fileCount + 1
          });
        }
      }
    }

    if (complexityData.size < 3) return null;

    // Convert to sorted array with average complexity per day
    const dataPoints = Array.from(complexityData.entries())
      .map(([date, data]) => ({
        date: new Date(date),
        value: data.totalComplexity / Math.max(1, data.fileCount) // Average complexity
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate linear regression for complexity trend
    const n = dataPoints.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (let i = 0; i < n; i++) {
      const x = i; // Time index
      const y = dataPoints[i]?.value || 0;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const avgY = sumY / n;
    let ssTotal = 0, ssResidual = 0;

    for (let i = 0; i < n; i++) {
      const y = dataPoints[i]?.value || 0;
      const yPred = slope * i + intercept;
      ssTotal += (y - avgY) * (y - avgY);
      ssResidual += (y - yPred) * (y - yPred);
    }

    const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;

    // Determine trend direction and strength
    const direction: 'increasing' | 'decreasing' | 'stable' =
      Math.abs(slope) < 0.5 ? 'stable' :
      slope > 0 ? 'increasing' : 'decreasing';

    const strength: 'weak' | 'moderate' | 'strong' =
      rSquared < 0.3 ? 'weak' :
      rSquared < 0.7 ? 'moderate' : 'strong';

    return {
      metric: 'complexity',
      direction,
      slope,
      confidence: rSquared,
      timeRange: {
        start: dataPoints[0]?.date || new Date(),
        end: dataPoints[n - 1]?.date || new Date()
      },
      dataPoints: dataPoints.map(dp => ({
        date: dp.date,
        value: dp.value
      })),
      forecast: this.generateForecast(dataPoints, 30) // 30-day forecast
    };
  }

  private calculateChurnRateTrend(commits: GitCommit[]): TemporalTrend | null {
    if (commits.length < 3) return null;

    // Group commits by day and calculate churn rate (lines added + deleted) per day
    const dailyChurn = new Map<string, { linesAdded: number; linesDeleted: number; commits: number }>();

    for (const commit of commits) {
      const dateKey = commit.date.toISOString().split('T')[0];
      if (!dateKey) continue;
      const existing = dailyChurn.get(dateKey) || { linesAdded: 0, linesDeleted: 0, commits: 0 };

      dailyChurn.set(dateKey, {
        linesAdded: existing.linesAdded + commit.linesAdded,
        linesDeleted: existing.linesDeleted + commit.linesDeleted,
        commits: existing.commits + 1
      });
    }

    if (dailyChurn.size < 3) return null;

    // Convert to sorted array with total churn per day
    const dataPoints = Array.from(dailyChurn.entries())
      .map(([date, data]) => ({
        date: new Date(date),
        value: data.linesAdded + data.linesDeleted, // Total churn
        details: {
          linesAdded: data.linesAdded,
          linesDeleted: data.linesDeleted,
          commits: data.commits,
          avgChurnPerCommit: (data.linesAdded + data.linesDeleted) / Math.max(1, data.commits)
        }
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate linear regression for churn trend
    const n = dataPoints.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (let i = 0; i < n; i++) {
      const x = i; // Time index
      const y = dataPoints[i]?.value || 0;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const avgY = sumY / n;
    let ssTotal = 0, ssResidual = 0;

    for (let i = 0; i < n; i++) {
      const y = dataPoints[i]?.value || 0;
      const yPred = slope * i + intercept;
      ssTotal += (y - avgY) * (y - avgY);
      ssResidual += (y - yPred) * (y - yPred);
    }

    const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;

    // Determine trend direction and strength
    const direction: 'increasing' | 'decreasing' | 'stable' =
      Math.abs(slope) < 10 ? 'stable' : // Less than 10 lines change per day
      slope > 0 ? 'increasing' : 'decreasing';

    const strength: 'weak' | 'moderate' | 'strong' =
      rSquared < 0.3 ? 'weak' :
      rSquared < 0.7 ? 'moderate' : 'strong';

    // Calculate additional metrics
    const avgChurn = sumY / n;
    const maxChurn = Math.max(...dataPoints.map(dp => dp.value));
    const volatility = Math.sqrt(dataPoints.reduce((sum, dp) => sum + Math.pow(dp.value - avgChurn, 2), 0) / n);

    return {
      metric: 'churn_rate',
      direction,
      slope,
      confidence: rSquared,
      timeRange: {
        start: dataPoints[0]?.date || new Date(),
        end: dataPoints[n - 1]?.date || new Date()
      },
      dataPoints: dataPoints.map(dp => ({
        date: dp.date,
        value: dp.value
      })),
      forecast: this.generateForecast(dataPoints, 30) // 30-day forecast
    };
  }

  private identifyOwnedFiles(author: string, commits: GitCommit[]): string[] {
    const fileContributions = new Map<string, number>();

    commits.filter(commit => commit.author === author).forEach(commit => {
      commit.filesChanged.forEach(file => {
        fileContributions.set(file, (fileContributions.get(file) || 0) + 1);
      });
    });

    // Return files where author has >50% of commits
    const totalCommitsByFile = new Map<string, number>();
    commits.forEach(commit => {
      commit.filesChanged.forEach(file => {
        totalCommitsByFile.set(file, (totalCommitsByFile.get(file) || 0) + 1);
      });
    });

    return Array.from(fileContributions.entries())
      .filter(([file, authorCommits]) => {
        const totalCommits = totalCommitsByFile.get(file) || 1;
        return authorCommits / totalCommits > 0.5;
      })
      .map(([file]) => file);
  }

  private identifySpecializations(author: string, commits: GitCommit[]): string[] {
    const extensions = new Map<string, number>();

    commits.filter(commit => commit.author === author).forEach(commit => {
      commit.filesChanged.forEach(file => {
        const ext = path.extname(file);
        if (ext) {
          extensions.set(ext, (extensions.get(ext) || 0) + 1);
        }
      });
    });

    // Return top 3 file extensions
    return Array.from(extensions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([ext]) => ext);
  }

  private identifyCollaborators(author: string, commits: GitCommit[]): string[] {
    const collaborators = new Set<string>();
    const authorFiles = new Set<string>();

    // Get files touched by this author
    commits.filter(commit => commit.author === author).forEach(commit => {
      commit.filesChanged.forEach(file => authorFiles.add(file));
    });

    // Find other authors who touched the same files
    commits.filter(commit => commit.author !== author).forEach(commit => {
      if (commit.filesChanged.some(file => authorFiles.has(file))) {
        collaborators.add(commit.author);
      }
    });

    return Array.from(collaborators);
  }

  private calculateCodeQualityScore(author: string, issues: UnifiedIssue[]): number {
    if (issues.length === 0) return 1.0; // No issues = perfect score

    // Separate issues by type (introduced vs fixed)
    const authorIssues = issues.filter(issue => {
      // Check if this author was involved in introducing or fixing the issue
      return issue.metadata?.author === author ||
             issue.metadata?.contributors?.includes(author) ||
             issue.entity && this.isAuthorResponsibleForFile(author, issue.entity.canonicalPath);
    });

    if (authorIssues.length === 0) return 0.8; // Default score when no clear attribution

    // Calculate scores based on issue severity and resolution
    let totalImpact = 0;
    let positiveImpact = 0;
    let negativeImpact = 0;

    for (const issue of authorIssues) {
      const severityWeight = this.getSeverityWeight(issue.severity);

      // Check if this is a fix or an introduction
      if (this.isIssueFix(issue)) {
        positiveImpact += severityWeight;
      } else {
        negativeImpact += severityWeight;
      }
      totalImpact += severityWeight;
    }

    if (totalImpact === 0) return 0.8;

    // Calculate quality score: more fixes relative to introductions = higher score
    const fixRatio = positiveImpact / totalImpact;
    const introductionRatio = negativeImpact / totalImpact;

    // Base score starts at 0.5, adjusted by fix vs introduction ratio
    let qualityScore = 0.5 + (fixRatio - introductionRatio) * 0.4;

    // Bonus for consistent fixing behavior
    if (fixRatio > 0.7) qualityScore += 0.1;

    // Penalty for high introduction rate
    if (introductionRatio > 0.6) qualityScore -= 0.15;

    return Math.max(0.1, Math.min(1.0, qualityScore));
  }

  private getSeverityWeight(severity: string): number {
    switch (severity?.toLowerCase()) {
      case 'critical': return 4.0;
      case 'high': return 3.0;
      case 'medium': return 2.0;
      case 'low': return 1.0;
      case 'info': return 0.5;
      default: return 1.5;
    }
  }

  private isIssueFix(issue: UnifiedIssue): boolean {
    // Heuristics to determine if this is a fix vs introduction
    const description = issue.description?.toLowerCase() || '';
    const title = issue.title?.toLowerCase() || '';

    // Look for fix-related keywords
    const fixKeywords = ['fix', 'resolve', 'solve', 'patch', 'correct', 'repair', 'address'];
    const introKeywords = ['add', 'implement', 'create', 'new', 'initial'];

    const hasFixKeywords = fixKeywords.some(keyword =>
      description.includes(keyword) || title.includes(keyword)
    );

    const hasIntroKeywords = introKeywords.some(keyword =>
      description.includes(keyword) || title.includes(keyword)
    );

    // If we have git metadata, use that
    if (issue.metadata?.commitType) {
      return issue.metadata.commitType === 'fix' || issue.metadata.commitType === 'patch';
    }

    // Default heuristic: more fix keywords than intro keywords
    return hasFixKeywords && !hasIntroKeywords;
  }

  private isAuthorResponsibleForFile(author: string, filePath: string): boolean {
    // This would ideally check git blame or file ownership data
    // For now, return false to be conservative
    return false;
  }

  private determineExperienceLevel(metrics: AuthorMetrics): AuthorMetrics['experienceLevel'] {
    if (metrics.commits > 1000) return 'expert';
    if (metrics.commits > 500) return 'senior';
    if (metrics.commits > 100) return 'mid';
    return 'junior';
  }

  private analyzeWorkingPatterns(author: string, commits: GitCommit[]): WorkingPattern[] {
    const authorCommits = commits.filter(c => c.author === author);
    if (authorCommits.length < 10) return []; // Need sufficient data

    const patterns: WorkingPattern[] = [];

    // Analyze time-of-day patterns
    const hourlyActivity = new Array(24).fill(0);
    const dailyActivity = new Array(7).fill(0); // Sunday = 0

    for (const commit of authorCommits) {
      const hour = commit.date.getHours();
      const day = commit.date.getDay();
      hourlyActivity[hour]++;
      dailyActivity[day]++;
    }

    // Find peak hours
    const maxHourlyActivity = Math.max(...hourlyActivity);
    const peakHours = hourlyActivity
      .map((count, hour) => ({ hour, count }))
      .filter(h => h.count >= maxHourlyActivity * 0.8)
      .map(h => h.hour);

    if (peakHours.length > 0) {
      patterns.push({
        type: 'daily_activity',
        pattern: 'peak_hours',
        description: `Most active during hours: ${peakHours.join(', ')}`,
        confidence: this.calculatePatternConfidence(hourlyActivity),
        frequency: maxHourlyActivity / authorCommits.length,
        metadata: { peakHours, hourlyDistribution: hourlyActivity }
      });
    }

    // Analyze day-of-week patterns
    const maxDailyActivity = Math.max(...dailyActivity);
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const peakDays = dailyActivity
      .map((count, day) => ({ day, name: weekdays[day], count }))
      .filter(d => d.count >= maxDailyActivity * 0.7);

    if (peakDays.length > 0) {
      patterns.push({
        type: 'weekly_pattern',
        pattern: 'peak_days',
        description: `Most active on: ${peakDays.map(d => d.name).join(', ')}`,
        confidence: this.calculatePatternConfidence(dailyActivity),
        frequency: maxDailyActivity / authorCommits.length,
        metadata: { peakDays: peakDays.map(d => d.name), dailyDistribution: dailyActivity }
      });
    }

    // Analyze commit frequency patterns
    const commitsByMonth = this.groupCommitsByMonth(authorCommits);
    const monthlyVariance = this.calculateVariance(Object.values(commitsByMonth));

    if (monthlyVariance > 0.5) {
      patterns.push({
        type: 'commit_size',
        pattern: 'irregular_frequency',
        description: 'Irregular commit frequency with high variance',
        confidence: 0.8,
        frequency: monthlyVariance,
        metadata: { monthlyCommits: commitsByMonth, variance: monthlyVariance }
      });
    }

    // Analyze burst patterns (many commits in short periods)
    const burstPeriods = this.detectBurstPeriods(authorCommits);
    if (burstPeriods.length > 0) {
      patterns.push({
        type: 'commit_size',
        pattern: 'burst_activity',
        description: `Tends to work in bursts: ${burstPeriods.length} burst periods detected`,
        confidence: 0.9,
        frequency: burstPeriods.length / (authorCommits.length / 10), // Normalize by commits
        metadata: { burstPeriods, totalBursts: burstPeriods.length }
      });
    }

    return patterns;
  }

  private calculatePatternConfidence(distribution: number[]): number {
    const total = distribution.reduce((sum, count) => sum + count, 0);
    if (total === 0) return 0;

    // Calculate entropy to measure how concentrated the pattern is
    const probabilities = distribution.map(count => count / total).filter(p => p > 0);
    const entropy = -probabilities.reduce((sum, p) => sum + p * Math.log2(p), 0);
    const maxEntropy = Math.log2(distribution.length);

    // Higher concentration (lower entropy) = higher confidence
    return Math.max(0.1, 1 - (entropy / maxEntropy));
  }

  private groupCommitsByMonth(commits: GitCommit[]): Record<string, number> {
    const groups: Record<string, number> = {};

    for (const commit of commits) {
      const monthKey = `${commit.date.getFullYear()}-${commit.date.getMonth() + 1}`;
      groups[monthKey] = (groups[monthKey] || 0) + 1;
    }

    return groups;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  private detectBurstPeriods(commits: GitCommit[]): Array<{ start: Date; end: Date; commitCount: number }> {
    if (commits.length < 5) return [];

    const sortedCommits = commits.slice().sort((a, b) => a.date.getTime() - b.date.getTime());
    const burstPeriods = [];
    const burstThreshold = 3; // Minimum commits in a burst
    const timeWindow = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    let currentBurst = [sortedCommits[0]];

    for (let i = 1; i < sortedCommits.length; i++) {
      const commit = sortedCommits[i];
      const lastCommit = currentBurst[currentBurst.length - 1];

      if (commit && lastCommit && commit.date.getTime() - lastCommit.date.getTime() <= timeWindow) {
        currentBurst.push(commit);
      } else {
        // End of potential burst
        if (currentBurst.length >= burstThreshold) {
          burstPeriods.push({
            start: currentBurst[0]?.date || new Date(),
            end: currentBurst[currentBurst.length - 1]?.date || new Date(),
            commitCount: currentBurst.length
          });
        }
        currentBurst = [commit];
      }
    }

    // Check final burst
    if (currentBurst.length >= burstThreshold) {
      burstPeriods.push({
        start: currentBurst[0]?.date || new Date(),
        end: currentBurst[currentBurst.length - 1]?.date || new Date(),
        commitCount: currentBurst.length
      });
    }

    return burstPeriods;
  }

  private generateIssuePrediction(trends: TemporalTrend[], fileHistory: FileHistory[]): PredictiveAnalysis | null {
    if (trends.length === 0 || fileHistory.length === 0) return null;

    // Analyze issue count trends
    const issueCountTrend = trends.find(t => t.metric === 'issue_count');
    if (!issueCountTrend || issueCountTrend.dataPoints.length < 3) return null;

    const recentDataPoints = issueCountTrend.dataPoints.slice(-10); // Last 10 data points
    const avgIssueCount = recentDataPoints.reduce((sum, dp) => sum + dp.value, 0) / recentDataPoints.length;

    // Calculate velocity of issue introduction
    const velocityPoints = recentDataPoints.map((dp, i) => {
      if (i === 0) return 0;
      const prev = recentDataPoints[i - 1];
      if (!prev) return 0;
      const timeDiff = (dp.date.getTime() - prev.date.getTime()) / (1000 * 60 * 60 * 24);
      return timeDiff > 0 ? (dp.value - prev.value) / timeDiff : 0;
    }).slice(1); // Remove first 0

    const avgVelocity = velocityPoints.reduce((sum, v) => sum + v, 0) / velocityPoints.length;

    // Identify high-risk files
    const riskFiles = fileHistory
      .filter(fh => fh.issueHistory.length > 0)
      .map(fh => {
        const recentIssues = fh.issueHistory.slice(-5);
        const lastIssue = recentIssues[recentIssues.length - 1];
        const firstIssue = recentIssues[0];
        const issueGrowthRate = recentIssues.length > 1 && lastIssue && firstIssue ?
          (lastIssue.newIssues - firstIssue.newIssues) / recentIssues.length : 0;

        return {
          file: fh.filePath,
          riskScore: this.calculateFileRiskScore(fh),
          growthRate: issueGrowthRate,
          totalIssues: recentIssues.reduce((sum, ih) => sum + ih.newIssues, 0)
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10); // Top 10 risky files

    // Generate prediction
    const predictionWindow = 30; // 30 days
    const predictedIssueCount = Math.max(0, avgIssueCount + (avgVelocity * predictionWindow));

    // Calculate confidence based on trend consistency
    const trendConsistency = this.calculateTrendConsistency(recentDataPoints);
    const confidence = Math.max(0.1, Math.min(0.9, trendConsistency));

    return {
      type: 'issue_prediction',
      timeHorizon: predictionWindow,
      confidence: confidence,
      predictions: [{
        target: 'expected_new_issues',
        currentValue: recentDataPoints[recentDataPoints.length - 1]?.value || 0,
        predictedValue: Math.round(predictedIssueCount),
        changePercentage: avgVelocity * 100,
        probability: confidence
      }],
      riskFactors: [
        {
          factor: 'issue_velocity',
          weight: Math.abs(avgVelocity),
          impact: Math.abs(avgVelocity),
          description: `Issues ${avgVelocity > 0 ? 'increasing' : 'decreasing'} at ${Math.abs(avgVelocity).toFixed(2)} per day`,
          mitigation: 'Monitor high-velocity files and implement preventive measures'
        },
        {
          factor: 'high_risk_files',
          weight: riskFiles.length / 10,
          impact: riskFiles.length / 10, // Normalize to 0-1
          description: `${riskFiles.length} files identified as high-risk`,
          mitigation: 'Focus testing and code review on high-risk files'
        }
      ],
      recommendations: this.generateIssueRecommendations(avgVelocity, riskFiles),
      metadata: {
        basedOnTrends: trends.map(t => t.metric),
        riskFiles: riskFiles.slice(0, 5), // Top 5 for metadata
        analysisWindow: recentDataPoints.length,
        confidence_factors: {
          trend_consistency: trendConsistency,
          data_points: recentDataPoints.length,
          velocity_stability: this.calculateVelocityStability(velocityPoints)
        }
      }
    };
  }

  private calculateFileRiskScore(fileHistory: FileHistory): number {
    if (fileHistory.issueHistory.length === 0) return 0;

    const recentHistory = fileHistory.issueHistory.slice(-5);

    // Factors contributing to risk score
    let riskScore = 0;

    // Issue frequency
    const avgNewIssues = recentHistory.reduce((sum, ih) => sum + ih.newIssues, 0) / recentHistory.length;
    riskScore += avgNewIssues * 0.3;

    // Fix rate (lower fix rate = higher risk)
    const avgFixedIssues = recentHistory.reduce((sum, ih) => sum + ih.fixedIssues, 0) / recentHistory.length;
    const fixRate = avgNewIssues > 0 ? avgFixedIssues / avgNewIssues : 1;
    riskScore += (1 - fixRate) * 0.4;

    // Complexity growth
    if (fileHistory.complexity && fileHistory.complexity.length > 1) {
      const complexityTrend = this.calculateComplexityTrend([fileHistory]);
      if (complexityTrend && complexityTrend.direction === 'increasing') {
        riskScore += complexityTrend.slope * 0.2;
      }
    }

    // Change frequency (more changes = potentially more risk)
    const changeFrequency = fileHistory.commits.length / Math.max(1, fileHistory.issueHistory.length);
    riskScore += Math.min(1, changeFrequency / 10) * 0.1;

    return Math.min(1, riskScore);
  }

  private calculateTrendConsistency(dataPoints: Array<{ date: Date; value: number }>): number {
    if (dataPoints.length < 3) return 0.5;

    // Calculate how well the data fits a linear trend
    const n = dataPoints.length;
    const x = Array.from({length: n}, (_, i) => i);
    const y = dataPoints.map(dp => dp.value);

    // Linear regression
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * (y[i] || 0), 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const meanY = sumY / n;
    const ssTotal = y.reduce((total, yi) => total + Math.pow(yi - meanY, 2), 0);
    const ssRes = y.reduce((total, yi, i) => {
      const predicted = slope * (x[i] || 0) + intercept;
      return total + Math.pow(yi - predicted, 2);
    }, 0);

    const rSquared = 1 - (ssRes / ssTotal);
    return Math.max(0, Math.min(1, rSquared));
  }

  private calculateVelocityStability(velocityPoints: number[]): number {
    if (velocityPoints.length < 2) return 0.5;

    const mean = velocityPoints.reduce((sum, v) => sum + v, 0) / velocityPoints.length;
    const variance = velocityPoints.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / velocityPoints.length;

    // Lower variance = higher stability
    return Math.max(0.1, Math.min(1, 1 / (1 + variance)));
  }

  private generateIssueRecommendations(velocity: number, riskFiles: Array<{file: string; riskScore: number}>): string[] {
    const recommendations = [];

    if (velocity > 0.5) {
      recommendations.push('Consider increasing code review rigor to catch issues earlier');
      recommendations.push('Implement additional automated testing to prevent regressions');
    } else if (velocity < -0.1) {
      recommendations.push('Current issue resolution rate is positive - maintain current practices');
    }

    if (riskFiles.length > 5) {
      recommendations.push(`Focus refactoring efforts on high-risk files: ${riskFiles.slice(0, 3).map(rf => rf.file).join(', ')}`);
      recommendations.push('Consider breaking down complex files into smaller, more manageable modules');
    }

    if (riskFiles.length > 0) {
      const avgRisk = riskFiles.reduce((sum, rf) => sum + rf.riskScore, 0) / riskFiles.length;
      if (avgRisk > 0.7) {
        recommendations.push('High overall file risk detected - prioritize technical debt reduction');
      }
    }

    return recommendations.length > 0 ? recommendations : ['Continue monitoring trends for emerging patterns'];
  }

  private generateHotspotPrediction(patterns: TemporalPattern[], fileHistory: FileHistory[]): PredictiveAnalysis | null {
    if (patterns.length === 0 || fileHistory.length === 0) return null;

    // Analyze patterns to identify potential hotspots
    const hotspotIndicators = this.analyzeHotspotIndicators(patterns, fileHistory);
    if (hotspotIndicators.length === 0) return null;

    // Calculate hotspot probability for each file
    const fileRiskAnalysis = fileHistory.map(fh => {
      const riskFactors = this.calculateHotspotRisk(fh, patterns);
      return {
        file: fh.filePath,
        hotspotProbability: riskFactors.probability,
        riskFactors: riskFactors.factors,
        currentActivityLevel: this.calculateCurrentActivityLevel(fh),
        predictedTimeToHotspot: riskFactors.timeToHotspot
      };
    }).filter(analysis => analysis.hotspotProbability > 0.3) // Only include significant risks
      .sort((a, b) => b.hotspotProbability - a.hotspotProbability)
      .slice(0, 10); // Top 10 candidates

    if (fileRiskAnalysis.length === 0) return null;

    // Generate overall confidence based on pattern strength
    const patternStrength = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
    const dataQuality = this.assessDataQuality(fileHistory);
    const overallConfidence = Math.min(0.9, Math.max(0.1, patternStrength * dataQuality));

    const predictionWindow = 60; // 60 days
    const highRiskFiles = fileRiskAnalysis.filter(analysis => analysis.hotspotProbability > 0.7);

    return {
      type: 'hotspot_prediction',
      timeHorizon: predictionWindow,
      confidence: overallConfidence,
      predictions: [{
        target: 'potential_hotspots',
        currentValue: fileHistory.filter(fh => fh.issueHistory.length > 5).length,
        predictedValue: highRiskFiles.length,
        changePercentage: ((highRiskFiles.length / Math.max(fileHistory.length, 1)) - 0.1) * 100,
        probability: overallConfidence
      }],
      riskFactors: [
        {
          factor: 'pattern_based_risk',
          weight: patternStrength,
          impact: patternStrength,
          description: `${patterns.length} temporal patterns detected indicating potential hotspot formation`,
          mitigation: 'Address patterns through code review and refactoring'
        },
        {
          factor: 'file_activity_increase',
          weight: this.calculateActivityIncreaseFactor(fileRiskAnalysis),
          impact: this.calculateActivityIncreaseFactor(fileRiskAnalysis),
          description: 'Files showing increased activity patterns that correlate with hotspot formation',
          mitigation: 'Monitor and stabilize high-activity files'
        },
        {
          factor: 'change_frequency_acceleration',
          weight: this.calculateChangeAccelerationFactor(fileHistory),
          impact: this.calculateChangeAccelerationFactor(fileHistory),
          description: 'Acceleration in change frequency detected in multiple files',
          mitigation: 'Implement change management controls'
        }
      ],
      recommendations: this.generateHotspotRecommendations(fileRiskAnalysis, patterns),
      metadata: {
        candidateFiles: fileRiskAnalysis.slice(0, 5),
        basedOnPatterns: patterns.map(p => p.type),
        analysisWindow: predictionWindow,
        confidence_factors: {
          pattern_strength: patternStrength,
          data_quality: dataQuality,
          file_coverage: fileHistory.length,
          pattern_consistency: this.calculatePatternConsistency(patterns)
        },
        hotspotIndicators: hotspotIndicators
      }
    };
  }

  private analyzeHotspotIndicators(patterns: TemporalPattern[], fileHistory: FileHistory[]): Array<{
    indicator: string;
    strength: number;
    description: string;
  }> {
    const indicators = [];

    // Check for increasing issue density patterns (use quality_degradation as closest match)
    const densityPatterns = patterns.filter(p => p.type === 'quality_degradation');
    if (densityPatterns.length > 0) {
      const avgStrength = densityPatterns.reduce((sum, p) => sum + p.confidence, 0) / densityPatterns.length;
      indicators.push({
        indicator: 'increasing_issue_density',
        strength: avgStrength,
        description: `${densityPatterns.length} files showing increasing issue density`
      });
    }

    // Check for change frequency acceleration
    const changeAcceleration = this.detectChangeAcceleration(fileHistory);
    if (changeAcceleration > 0.3) {
      indicators.push({
        indicator: 'change_acceleration',
        strength: changeAcceleration,
        description: 'Detected acceleration in change frequency across multiple files'
      });
    }

    // Check for author concentration patterns
    const authorConcentration = this.detectAuthorConcentration(fileHistory);
    if (authorConcentration > 0.4) {
      indicators.push({
        indicator: 'author_concentration',
        strength: authorConcentration,
        description: 'High concentration of changes by specific authors may indicate emerging hotspots'
      });
    }

    return indicators;
  }

  private calculateHotspotRisk(fileHistory: FileHistory, patterns: TemporalPattern[]): {
    probability: number;
    factors: Array<{ factor: string; weight: number }>;
    timeToHotspot: number | null;
  } {
    let probability = 0;
    const factors = [];

    // Factor 1: Recent change frequency
    const recentCommits = fileHistory.commits.slice(-10);
    const changeFrequency = recentCommits.length / Math.max(1, 30); // commits per day over last month
    const frequencyWeight = Math.min(0.3, changeFrequency * 0.1);
    probability += frequencyWeight;
    factors.push({ factor: 'change_frequency', weight: frequencyWeight });

    // Factor 2: Issue growth rate
    if (fileHistory.issueHistory.length > 2) {
      const recentIssues = fileHistory.issueHistory.slice(-3);
      const issueGrowth = recentIssues.reduce((sum, ih) => sum + ih.newIssues, 0) / recentIssues.length;
      const issueWeight = Math.min(0.25, issueGrowth * 0.05);
      probability += issueWeight;
      factors.push({ factor: 'issue_growth', weight: issueWeight });
    }

    // Factor 3: Pattern matching
    const relevantPatterns = patterns.filter(p =>
      p.description.includes(fileHistory.filePath) ||
      p.type === 'hotspot_formation'
    );
    const patternWeight = relevantPatterns.reduce((sum, p) => sum + p.confidence * 0.1, 0);
    probability += patternWeight;
    if (patternWeight > 0) {
      factors.push({ factor: 'pattern_match', weight: patternWeight });
    }

    // Factor 4: Complexity growth
    if (fileHistory.complexity && fileHistory.complexity.length > 1) {
      const complexityIncrease = this.calculateComplexityIncrease(fileHistory.complexity);
      const complexityWeight = Math.min(0.15, complexityIncrease * 0.03);
      probability += complexityWeight;
      factors.push({ factor: 'complexity_growth', weight: complexityWeight });
    }

    // Estimate time to hotspot based on current trajectory
    let timeToHotspot = null;
    if (probability > 0.5 && changeFrequency > 0) {
      // Rough estimate: if current trend continues, when will this become critical?
      timeToHotspot = Math.max(7, 60 / changeFrequency); // Days
    }

    return {
      probability: Math.min(0.95, probability),
      factors,
      timeToHotspot
    };
  }

  private calculateCurrentActivityLevel(fileHistory: FileHistory): 'low' | 'medium' | 'high' | 'critical' {
    const recentCommits = fileHistory.commits.slice(-5).length;
    const recentIssues = fileHistory.issueHistory.slice(-3).reduce((sum, ih) => sum + ih.newIssues, 0);

    const activityScore = recentCommits * 0.3 + recentIssues * 0.7;

    if (activityScore > 10) return 'critical';
    if (activityScore > 5) return 'high';
    if (activityScore > 2) return 'medium';
    return 'low';
  }

  private determineHotspotTrend(fileRiskAnalysis: Array<{ hotspotProbability: number }>): 'increasing' | 'stable' | 'decreasing' {
    const highRiskCount = fileRiskAnalysis.filter(f => f.hotspotProbability > 0.7).length;
    const mediumRiskCount = fileRiskAnalysis.filter(f => f.hotspotProbability > 0.5).length;

    if (highRiskCount > 3) return 'increasing';
    if (mediumRiskCount > 5) return 'increasing';
    if (highRiskCount === 0 && mediumRiskCount < 2) return 'decreasing';
    return 'stable';
  }

  private calculateActivityIncreaseFactor(fileRiskAnalysis: Array<{ currentActivityLevel: string }>): number {
    const highActivityCount = fileRiskAnalysis.filter(f =>
      f.currentActivityLevel === 'high' || f.currentActivityLevel === 'critical'
    ).length;

    return Math.min(1, highActivityCount / Math.max(1, fileRiskAnalysis.length));
  }

  private calculateChangeAccelerationFactor(fileHistory: FileHistory[]): number {
    let totalAcceleration = 0;
    let fileCount = 0;

    for (const fh of fileHistory) {
      if (fh.commits.length >= 4) {
        const recentCommits = fh.commits.slice(-4);
        const olderCommits = fh.commits.slice(-8, -4);

        if (olderCommits.length > 0) {
          const recentRate = recentCommits.length / 30; // per day
          const olderRate = olderCommits.length / 30;

          if (olderRate > 0) {
            totalAcceleration += (recentRate - olderRate) / olderRate;
            fileCount++;
          }
        }
      }
    }

    return fileCount > 0 ? Math.max(0, totalAcceleration / fileCount) : 0;
  }

  private detectChangeAcceleration(fileHistory: FileHistory[]): number {
    return this.calculateChangeAccelerationFactor(fileHistory);
  }

  private detectAuthorConcentration(fileHistory: FileHistory[]): number {
    const authorChanges = new Map<string, number>();
    let totalChanges = 0;

    for (const fh of fileHistory) {
      for (const commit of fh.commits.slice(-10)) { // Recent commits only
        const author = commit.author;
        authorChanges.set(author, (authorChanges.get(author) || 0) + 1);
        totalChanges++;
      }
    }

    if (totalChanges === 0) return 0;

    // Calculate concentration using Herfindahl index
    const authorShares = Array.from(authorChanges.values()).map(count => count / totalChanges);
    const concentration = authorShares.reduce((sum, share) => sum + share * share, 0);

    return concentration;
  }

  private assessDataQuality(fileHistory: FileHistory[]): number {
    let qualityScore = 1.0;

    // Penalize for insufficient data
    const avgHistoryLength = fileHistory.reduce((sum, fh) => sum + fh.commits.length, 0) / fileHistory.length;
    if (avgHistoryLength < 5) qualityScore *= 0.7;

    // Penalize for sparse issue data
    const filesWithIssues = fileHistory.filter(fh => fh.issueHistory.length > 0).length;
    const issueDataCoverage = filesWithIssues / fileHistory.length;
    qualityScore *= issueDataCoverage;

    return Math.max(0.1, qualityScore);
  }

  private calculateComplexityIncrease(complexityHistory: Array<{ cyclomaticComplexity: number }>): number {
    if (complexityHistory.length < 2) return 0;

    const recent = complexityHistory.slice(-2);
    const older = complexityHistory.slice(-4, -2);

    if (older.length === 0) return 0;

    const recentAvg = recent.reduce((sum, c) => sum + c.cyclomaticComplexity, 0) / recent.length;
    const olderAvg = older.reduce((sum, c) => sum + c.cyclomaticComplexity, 0) / older.length;

    return Math.max(0, (recentAvg - olderAvg) / Math.max(1, olderAvg));
  }

  private calculatePatternConsistency(patterns: TemporalPattern[]): number {
    if (patterns.length === 0) return 0;

    const avgConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
    const confidenceVariance = patterns.reduce((sum, p) => sum + Math.pow(p.confidence - avgConfidence, 2), 0) / patterns.length;

    // Lower variance = higher consistency
    return Math.max(0.1, 1 / (1 + confidenceVariance));
  }

  private generateHotspotRecommendations(
    fileRiskAnalysis: Array<{ file: string; hotspotProbability: number; currentActivityLevel: string }>,
    patterns: TemporalPattern[]
  ): string[] {
    const recommendations = [];

    const criticalFiles = fileRiskAnalysis.filter(f => f.hotspotProbability > 0.8);
    const highRiskFiles = fileRiskAnalysis.filter(f => f.hotspotProbability > 0.6);

    if (criticalFiles.length > 0) {
      recommendations.push(`URGENT: ${criticalFiles.length} files at critical risk of becoming hotspots - immediate intervention needed`);
      recommendations.push(`Focus on: ${criticalFiles.slice(0, 3).map(f => f.file).join(', ')}`);
    }

    if (highRiskFiles.length > 0) {
      recommendations.push('Implement preventive measures for high-risk files before they become problematic');
      recommendations.push('Consider code reviews and refactoring for files showing rapid change patterns');
    }

    const densityPatterns = patterns.filter(p => p.type === 'quality_degradation');
    if (densityPatterns.length > 2) {
      recommendations.push('Multiple files showing increasing issue density - review development practices');
    }

    if (fileRiskAnalysis.some(f => f.currentActivityLevel === 'critical')) {
      recommendations.push('Files with critical activity levels detected - monitor closely and limit concurrent changes');
    }

    return recommendations.length > 0 ? recommendations : ['Continue monitoring for emerging hotspot patterns'];
  }

  private calculateActualFixRate(issueHistory: IssueHistoryEntry[]): number {
    if (issueHistory.length === 0) return 0.5; // Default neutral value

    // Calculate fix rate based on newIssues vs fixedIssues over time
    let totalNewIssues = 0;
    let totalFixedIssues = 0;

    for (const entry of issueHistory) {
      totalNewIssues += entry.newIssues;
      totalFixedIssues += entry.fixedIssues;
    }

    if (totalNewIssues === 0) return 1.0; // No issues introduced = perfect fix rate

    const fixRate = totalFixedIssues / totalNewIssues;
    return Math.min(1.0, Math.max(0.0, fixRate)); // Clamp to [0, 1]
  }

  /**
   * Generate forecast based on historical data points using linear regression
   */
  private generateForecast(dataPoints: Array<{ date: Date; value: number }>, days: number): TrendForecast[] {
    if (dataPoints.length < 2) return [];

    // Sort by date
    const sortedPoints = dataPoints.slice().sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate linear regression
    const n = sortedPoints.length;
    const startTime = sortedPoints[0]?.date.getTime() || 0;

    // Convert dates to numeric values (days since start)
    const x = sortedPoints.map(p => (p.date.getTime() - startTime) / (1000 * 60 * 60 * 24));
    const y = sortedPoints.map(p => p.value);

    // Calculate slope and intercept
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * (y[i] || 0), 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared for confidence
    const meanY = sumY / n;
    const ssTotal = y.reduce((total, yi) => total + Math.pow(yi - meanY, 2), 0);
    const ssRes = y.reduce((total, yi, i) => {
      const predicted = slope * (x[i] || 0) + intercept;
      return total + Math.pow(yi - predicted, 2);
    }, 0);
    const rSquared = 1 - (ssRes / ssTotal);
    const baseConfidence = Math.max(0.1, Math.min(0.9, rSquared));

    // Generate forecast points
    const forecast = [];
    const lastDate = sortedPoints[sortedPoints.length - 1]?.date || new Date();

    for (let i = 1; i <= days; i++) {
      const forecastDate = new Date(lastDate.getTime() + i * 24 * 60 * 60 * 1000);
      const daysSinceStart = (forecastDate.getTime() - startTime) / (1000 * 60 * 60 * 24);
      const predictedValue = Math.max(0, slope * daysSinceStart + intercept);

      // Confidence decreases over time
      const timeDecay = Math.exp(-i / (days * 0.3));
      const confidence = baseConfidence * timeDecay;

      // Calculate uncertainty bounds (95% confidence interval approximation)
      const uncertainty = Math.sqrt(1 - rSquared) * predictedValue * 0.2;

      forecast.push({
        date: forecastDate,
        predictedValue,
        confidence,
        upperBound: predictedValue + uncertainty,
        lowerBound: Math.max(0, predictedValue - uncertainty)
      });
    }

    return forecast;
  }

  private calculateActualRegressionRate(issueHistory: IssueHistoryEntry[]): number {
    if (issueHistory.length <= 1) return 0.0; // Need at least 2 entries to detect regressions

    // Calculate regression rate by detecting when issue counts increase after decreasing
    let regressionEvents = 0;
    let totalOpportunities = 0;

    for (let i = 1; i < issueHistory.length; i++) {
      const prev = issueHistory[i - 1];
      const current = issueHistory[i];

      if (!prev || !current) continue;

      // Count opportunities for regression (when we fixed issues)
      if (prev.fixedIssues > 0) {
        totalOpportunities++;

        // Detect regression: new issues introduced in similar severity categories
        const prevCritical = prev.criticalCount;
        const currentCritical = current.criticalCount;
        const prevHigh = prev.highCount;
        const currentHigh = current.highCount;

        // Regression detected if critical or high severity issues increased
        if (currentCritical > prevCritical || currentHigh > prevHigh) {
          regressionEvents++;
        }
      }
    }

    if (totalOpportunities === 0) return 0.0;

    const regressionRate = regressionEvents / totalOpportunities;
    return Math.min(1.0, Math.max(0.0, regressionRate)); // Clamp to [0, 1]
  }
}