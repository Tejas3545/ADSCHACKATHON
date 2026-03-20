/**
 * Smart Commit Validator
 * Filters out spam/low-quality commits to prevent gaming the leaderboard
 */

export interface CommitValidationResult {
  isValid: boolean;
  reason?: string;
  qualityScore: number; // 0-100
}

interface FileChange {
  filename: string;
  additions: number;
  deletions: number;
  changes: number;
  status: string;
  patch?: string;
}

// Files that are typically low-value for spam detection
const LOW_VALUE_FILES = [
  /readme\.md$/i,
  /\.txt$/i,
  /\.gitignore$/i,
  /license/i,
  /changelog/i,
  /\.env\.example$/i,
];

// File extensions that indicate meaningful code
const CODE_FILE_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.cs',
  '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.html',
  '.css', '.scss', '.sass', '.vue', '.svelte', '.sql', '.sh', '.yaml', '.yml',
  '.json', '.xml', '.graphql',
];

// Spam patterns in commit diffs
const SPAM_PATTERNS = [
  /^[\s.,'!?;:\-_+=*#@$%^&()[\]{}|\\/<>~`"]+$/m, // Only punctuation/whitespace
  /^(\s*\n)+$/m, // Only newlines
  /^(\s{2,})+$/m, // Only spaces
  /^(test|testing|fix|update|change|modify|add|remove|delete)\.?$/i, // Single word commits
];

/**
 * Check if a file is low-value for quality assessment
 */
function isLowValueFile(filename: string): boolean {
  return LOW_VALUE_FILES.some(pattern => pattern.test(filename));
}

/**
 * Check if a file is a meaningful code file
 */
function isCodeFile(filename: string): boolean {
  return CODE_FILE_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(ext));
}

/**
 * Analyze the quality of additions/changes
 */
function analyzeChangeQuality(patch: string | undefined): { isSpam: boolean; meaningfulLines: number } {
  if (!patch) return { isSpam: false, meaningfulLines: 0 };
  
  const lines = patch.split('\n');
  const addedLines = lines.filter(line => line.startsWith('+')).map(line => line.substring(1).trim());
  
  let meaningfulLines = 0;
  let spamLines = 0;
  
  for (const line of addedLines) {
    // Skip diff metadata
    if (line.startsWith('+++')) continue;
    
    // Empty lines don't count
    if (line.length === 0) continue;
    
    // Check for spam patterns
    const isSpamLine = SPAM_PATTERNS.some(pattern => pattern.test(line));
    if (isSpamLine) {
      spamLines++;
      continue;
    }
    
    // Check for very short meaningless additions
    if (line.length < 3) {
      spamLines++;
      continue;
    }
    
    // Check for repetitive characters (e.g., "aaaaa", ".....", "-----")
    if (/^(.)\1{4,}$/.test(line)) {
      spamLines++;
      continue;
    }
    
    meaningfulLines++;
  }
  
  const totalLines = addedLines.length - lines.filter(l => l.startsWith('+++')).length;
  const spamRatio = totalLines > 0 ? spamLines / totalLines : 0;
  
  return {
    isSpam: spamRatio > 0.7, // If >70% of lines are spam, mark as spam
    meaningfulLines,
  };
}

/**
 * Validate a commit to determine if it's legitimate or spam
 * 
 * Quality scoring criteria:
 * - Code files: +20 points per file
 * - Meaningful lines: +2 points per line
 * - Low-value file only changes: -30 points
 * - Very small changes (<5 meaningful lines): -20 points
 * - Multiple diverse files changed: +15 points
 * - Spam patterns detected: -50 points
 * 
 * Minimum threshold: 30 points to be considered valid
 */
export function validateCommit(
  filesChanged: FileChange[],
  minMeaningfulLines: number = 5,
  minFiles: number = 1
): CommitValidationResult {
  if (filesChanged.length === 0) {
    return {
      isValid: false,
      reason: "No files changed",
      qualityScore: 0,
    };
  }
  
  let qualityScore = 0;
  let totalMeaningfulLines = 0;
  let codeFileCount = 0;
  let lowValueOnlyChange = true;
  let spamDetected = false;
  
  // Analyze each file
  for (const file of filesChanged) {
    const isCode = isCodeFile(file.filename);
    const isLowValue = isLowValueFile(file.filename);
    
    if (!isLowValue) {
      lowValueOnlyChange = false;
    }
    
    if (isCode) {
      codeFileCount++;
      qualityScore += 20;
    }
    
    // Analyze the patch for spam
    const analysis = analyzeChangeQuality(file.patch);
    totalMeaningfulLines += analysis.meaningfulLines;
    
    if (analysis.isSpam) {
      spamDetected = true;
      qualityScore -= 50;
    } else {
      qualityScore += analysis.meaningfulLines * 2;
    }
    
    // Bonus for substantial changes
    if (file.additions + file.deletions > 50) {
      qualityScore += 10;
    }
  }
  
  // Check if only low-value files were changed
  if (lowValueOnlyChange && filesChanged.length === 1) {
    const onlyFile = filesChanged[0];
    const isReadmeOnly = /readme\.md$/i.test(onlyFile.filename);
    if (isReadmeOnly && totalMeaningfulLines >= minMeaningfulLines) {
      qualityScore += 20;
    } else {
      qualityScore -= 30;
      return {
        isValid: false,
        reason: "Only documentation files changed (e.g., README). Push meaningful code changes.",
        qualityScore: Math.max(0, qualityScore),
      };
    }
  }
  
  // Check minimum files requirement
  if (filesChanged.length < minFiles) {
    qualityScore -= 20;
    return {
      isValid: false,
      reason: `At least ${minFiles} file(s) must be changed`,
      qualityScore: Math.max(0, qualityScore),
    };
  }
  
  // Check for very small changes
  if (totalMeaningfulLines < minMeaningfulLines) {
    qualityScore -= 20;
    return {
      isValid: false,
      reason: `Commit too small. Need at least ${minMeaningfulLines} meaningful lines of code.`,
      qualityScore: Math.max(0, qualityScore),
    };
  }
  
  // Bonus for diverse file changes
  if (filesChanged.length > 3 && codeFileCount > 1) {
    qualityScore += 15;
  }
  
  // Spam detected
  if (spamDetected) {
    return {
      isValid: false,
      reason: "Spam patterns detected in commit. Please make meaningful code changes.",
      qualityScore: Math.max(0, qualityScore),
    };
  }
  
  // Final quality check
  const QUALITY_THRESHOLD = 30;
  if (qualityScore < QUALITY_THRESHOLD) {
    return {
      isValid: false,
      reason: `Commit quality too low (score: ${qualityScore}/${QUALITY_THRESHOLD}). Add more substantial code changes.`,
      qualityScore: Math.max(0, qualityScore),
    };
  }
  
  return {
    isValid: true,
    qualityScore: Math.min(100, qualityScore),
  };
}

/**
 * Quick validation for commits without patch data
 * Uses simpler heuristics based on file changes and additions
 */
export function quickValidateCommit(
  filesChanged: { filename: string; additions: number }[],
  minMeaningfulLines: number = 10,
  minFiles: number = 1
): CommitValidationResult {
  if (filesChanged.length < minFiles) {
    return {
      isValid: false,
      reason: `At least ${minFiles} file(s) must be changed`,
      qualityScore: 0,
    };
  }
  
  const totalAdditions = filesChanged.reduce((sum, f) => sum + f.additions, 0);
  const codeFiles = filesChanged.filter(f => isCodeFile(f.filename));
  const lowValueOnly = filesChanged.every(f => isLowValueFile(f.filename));
  
  if (lowValueOnly && filesChanged.length === 1) {
    const onlyFile = filesChanged[0];
    const isReadmeOnly = /readme\.md$/i.test(onlyFile.filename);
    if (!(isReadmeOnly && totalAdditions >= minMeaningfulLines)) {
      return {
        isValid: false,
        reason: "Only documentation files changed. Push meaningful code changes.",
        qualityScore: 10,
      };
    }
  }
  
  if (totalAdditions < minMeaningfulLines) {
    return {
      isValid: false,
      reason: `Need at least ${minMeaningfulLines} lines added`,
      qualityScore: Math.min(30, (totalAdditions / minMeaningfulLines) * 30),
    };
  }
  
  let qualityScore = 0;
  qualityScore += codeFiles.length * 20;
  qualityScore += Math.min(40, totalAdditions);
  qualityScore += filesChanged.length > 2 ? 15 : 0;
  
  return {
    isValid: qualityScore >= 30,
    qualityScore: Math.min(100, qualityScore),
  };
}
