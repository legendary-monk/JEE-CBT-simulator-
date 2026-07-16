/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Question, AnswerType } from './types';

/**
 * Parses a .tex file content following the custom JEE CBT tag schema.
 * Employs a brace-depth and block matching strategy to avoid false-positives in LaTeX math mode.
 */
export function parseTexFile(content: string): { questions: Question[]; errors: string[] } {
  const questions: Question[] = [];
  const errors: string[] = [];

  // Normalize carriage returns for Windows compatibility
  const normalizedNewlines = content.replace(/\r\n/g, '\n');

  // Preprocess: normalize quizquestion blocks to standard lowercase format with no internal whitespace
  const normalizedContent = normalizedNewlines
    .replace(/\\begin\s*\{\s*quizquestion\s*\}/gi, '\\begin{quizquestion}')
    .replace(/\\end\s*\{\s*quizquestion\s*\}/gi, '\\end{quizquestion}');

  // 1. Initial validation of matching begin/end counts
  const beginMatches = [...normalizedContent.matchAll(/\\begin\s*\{\s*quizquestion\s*\}/gi)];
  const endMatches = [...normalizedContent.matchAll(/\\end\s*\{\s*quizquestion\s*\}/gi)];

  if (beginMatches.length !== endMatches.length) {
    errors.push(`Mismatched question blocks: Found ${beginMatches.length} '\\begin{quizquestion}' and ${endMatches.length} '\\end{quizquestion}'.`);
    return { questions: [], errors };
  }

  let i = 0;
  const len = normalizedContent.length;

  // Helper to verify if character is escaped (e.g. \{ or \})
  const isEscaped = (pos: number, textStr: string): boolean => {
    let count = 0;
    let p = pos - 1;
    while (p >= 0 && textStr[p] === '\\') {
      count++;
      p--;
    }
    return count % 2 === 1;
  };

  while (i < len) {
    const nextBegin = normalizedContent.indexOf('\\begin{quizquestion}', i);
    if (nextBegin === -1) break;

    // The opening brace of QID should follow \begin{quizquestion}
    const afterBegin = nextBegin + '\\begin{quizquestion}'.length;
    let qidStartBrace = afterBegin;
    while (qidStartBrace < len && /\s/.test(normalizedContent[qidStartBrace])) {
      qidStartBrace++;
    }

    if (normalizedContent[qidStartBrace] !== '{') {
      errors.push(`Malformed \\begin{quizquestion} near position ${nextBegin}. Missing ID opening brace '{'.`);
      i = afterBegin;
      continue;
    }

    // Find matching closing brace for question ID
    let qidEndBrace = qidStartBrace + 1;
    let braceDepth = 1;
    while (qidEndBrace < len && braceDepth > 0) {
      const char = normalizedContent[qidEndBrace];
      if (char === '{' && !isEscaped(qidEndBrace, normalizedContent)) {
        braceDepth++;
      } else if (char === '}' && !isEscaped(qidEndBrace, normalizedContent)) {
        braceDepth--;
      }
      if (braceDepth > 0) {
        qidEndBrace++;
      }
    }

    if (braceDepth > 0) {
      errors.push(`Malformed question ID near position ${qidStartBrace}: unbalanced curly braces.`);
      i = qidStartBrace + 1;
      continue;
    }

    const questionId = normalizedContent.substring(qidStartBrace + 1, qidEndBrace).trim();
    if (!questionId) {
      errors.push(`Empty question ID near position ${qidStartBrace}.`);
      i = qidEndBrace + 1;
      continue;
    }

    // Now, find the matching \end{quizquestion}
    const searchPos = qidEndBrace + 1;
    let questionContentEnd = -1;
    let nestedBraceCheck = 0;
    let foundEnd = false;

    for (let j = searchPos; j < len - 17; j++) {
      const char = normalizedContent[j];

      // Track brace depth inside the question body to detect syntax issues early
      if (char === '{' && !isEscaped(j, normalizedContent)) {
        nestedBraceCheck++;
      } else if (char === '}' && !isEscaped(j, normalizedContent)) {
        nestedBraceCheck--;
      }

      if (normalizedContent.startsWith('\\end{quizquestion}', j)) {
        questionContentEnd = j;
        foundEnd = true;
        if (nestedBraceCheck !== 0) {
          errors.push(`Malformed question ${questionId}: Unbalanced curly braces inside question content (brace balance: ${nestedBraceCheck}).`);
        }
        i = j + '\\end{quizquestion}'.length;
        break;
      }
    }

    if (!foundEnd) {
      errors.push(`Malformed question ${questionId}: Missing corresponding '\\end{quizquestion}'.`);
      break;
    }

    const rawBlock = normalizedContent.substring(qidEndBrace + 1, questionContentEnd);
    const questionObj = parseQuestionBlock(questionId, rawBlock, errors);
    if (questionObj) {
      questions.push(questionObj);
    }
  }

  return { questions, errors };
}

/**
 * Helper to scan and extract all matching tag blocks like \tag{content}
 */
function extractTagContentWithBraces(block: string, tag: string): string[] {
  const results: string[] = [];
  let pos = 0;
  const tagPattern = '\\' + tag.toLowerCase();
  const lowerBlock = block.toLowerCase();

  const isEscaped = (p: number, textStr: string): boolean => {
    let count = 0;
    let idx = p - 1;
    while (idx >= 0 && textStr[idx] === '\\') {
      count++;
      idx--;
    }
    return count % 2 === 1;
  };

  while (pos < block.length) {
    const idx = lowerBlock.indexOf(tagPattern, pos);
    if (idx === -1) break;

    // Ignore escaped tags
    if (idx > 0 && block[idx - 1] === '\\') {
      pos = idx + tagPattern.length;
      continue;
    }

    // Verify tag word boundary (must be followed by whitespace or '{')
    const afterTag = idx + tagPattern.length;
    let scanBrace = afterTag;
    while (scanBrace < block.length && /\s/.test(block[scanBrace])) {
      scanBrace++;
    }

    if (block[scanBrace] !== '{') {
      pos = afterTag;
      continue;
    }

    // opening brace found, find matched closing brace
    let braceDepth = 1;
    let endPos = scanBrace + 1;
    while (endPos < block.length && braceDepth > 0) {
      const char = block[endPos];
      if (char === '{' && !isEscaped(endPos, block)) {
        braceDepth++;
      } else if (char === '}' && !isEscaped(endPos, block)) {
        braceDepth--;
      }
      if (braceDepth > 0) {
        endPos++;
      }
    }

    if (braceDepth === 0) {
      results.push(block.substring(scanBrace + 1, endPos));
      pos = endPos + 1;
    } else {
      pos = scanBrace + 1;
    }
  }

  return results;
}

/**
 * Strips parsed tags and comments to produce the clean standard question body.
 */
function cleanQuestionBody(rawBlock: string): string {
  // 1. Remove LaTeX comments
  const lines = rawBlock.split('\n');
  const cleanLines = lines.map(line => {
    let commentIdx = -1;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '%' && (i === 0 || line[i - 1] !== '\\')) {
        commentIdx = i;
        break;
      }
    }
    if (commentIdx !== -1) {
      return line.substring(0, commentIdx);
    }
    return line;
  });

  let text = cleanLines.join('\n');

  // 2. Remove standard tags from the body so they don't render
  const tagsToRemove = [
    'subject', 'topic', 'answertype', 'marks', 'option', 
    'correctoption', 'correctvalue', 'tolerance', 'modelanswer', 'difficulty'
  ];

  for (const tag of tagsToRemove) {
    const tagPattern = '\\' + tag.toLowerCase();
    let pos = 0;
    while (pos < text.length) {
      const lowerText = text.toLowerCase();
      const idx = lowerText.indexOf(tagPattern, pos);
      if (idx === -1) break;

      if (idx > 0 && text[idx - 1] === '\\') {
        pos = idx + tagPattern.length;
        continue;
      }

      const afterTag = idx + tagPattern.length;
      let scanBrace = afterTag;
      while (scanBrace < text.length && /\s/.test(text[scanBrace])) {
        scanBrace++;
      }

      if (text[scanBrace] !== '{') {
        pos = afterTag;
        continue;
      }

      // Find matching closing brace
      let braceDepth = 1;
      let endPos = scanBrace + 1;
      while (endPos < text.length && braceDepth > 0) {
        const char = text[endPos];
        if (char === '{' && (endPos === 0 || text[endPos - 1] !== '\\')) {
          braceDepth++;
        } else if (char === '}' && (endPos === 0 || text[endPos - 1] !== '\\')) {
          braceDepth--;
        }
        if (braceDepth > 0) {
          endPos++;
        }
      }

      if (braceDepth === 0) {
        text = text.substring(0, idx) + text.substring(endPos + 1);
        pos = idx;
      } else {
        pos = scanBrace + 1;
      }
    }
  }

  return text.trim();
}

/**
 * Parses individual fields in a quizquestion block
 */
function parseQuestionBlock(id: string, rawBlock: string, errors: string[]): Question | null {
  const subjects = extractTagContentWithBraces(rawBlock, 'subject');
  const topics = extractTagContentWithBraces(rawBlock, 'topic');
  const answerTypes = extractTagContentWithBraces(rawBlock, 'answertype');
  const marksList = extractTagContentWithBraces(rawBlock, 'marks');
  const options = extractTagContentWithBraces(rawBlock, 'option');
  const correctOptions = extractTagContentWithBraces(rawBlock, 'correctoption');
  const correctValues = extractTagContentWithBraces(rawBlock, 'correctvalue');
  const tolerances = extractTagContentWithBraces(rawBlock, 'tolerance');
  const modelAnswers = extractTagContentWithBraces(rawBlock, 'modelanswer');
  const difficulties = extractTagContentWithBraces(rawBlock, 'difficulty');

  // Explicit answertype is mandatory
  if (answerTypes.length === 0) {
    errors.push(`Malformed question ${id}: Missing '\\answertype{mcq|numerical|subjective}'.`);
    return null;
  }

  const answerTypeRaw = answerTypes[0].trim().toLowerCase();
  if (answerTypeRaw !== 'mcq' && answerTypeRaw !== 'numerical' && answerTypeRaw !== 'subjective') {
    errors.push(`Malformed question ${id}: Invalid \\answertype '${answerTypeRaw}'. Expected 'mcq', 'numerical', or 'subjective'.`);
    return null;
  }
  const answerType = answerTypeRaw as AnswerType;

  let correctOption: string | null = null;
  let correctValue: number | null = null;
  let tolerance: number | null = null;
  let modelAnswer: string | null = null;

  if (answerType === 'mcq') {
    if (options.length === 0) {
      errors.push(`Malformed question ${id}: MCQ question must have at least one '\\option{...}'.`);
      return null;
    }
    if (correctOptions.length === 0) {
      errors.push(`Malformed question ${id}: MCQ question must have a '\\correctoption{...}'.`);
      return null;
    }
    correctOption = correctOptions[0].trim();
  } else if (answerType === 'numerical') {
    if (correctValues.length === 0) {
      errors.push(`Malformed question ${id}: Numerical question must have a '\\correctvalue{...}'.`);
      return null;
    }
    const val = parseFloat(correctValues[0].trim());
    if (isNaN(val)) {
      errors.push(`Malformed question ${id}: '\\correctvalue' is not a valid number: '${correctValues[0]}'.`);
      return null;
    }
    correctValue = val;

    if (tolerances.length > 0) {
      // Strips symbols like ± to parse the tolerance value
      const rawTol = tolerances[0].trim().replace(/[±\+]/g, '').trim();
      const tol = parseFloat(rawTol);
      if (!isNaN(tol)) {
        tolerance = tol;
      }
    }
  } else if (answerType === 'subjective') {
    if (modelAnswers.length === 0) {
      errors.push(`Malformed question ${id}: Subjective question must have a '\\modelanswer{...}'.`);
      return null;
    }
    modelAnswer = modelAnswers[0].trim();
  }

  // Fallbacks for subject/topic
  const subject = subjects.length > 0 ? subjects[0].trim() : 'Unclassified';
  const topic = topics.length > 0 ? topics[0].trim() : 'Unclassified';

  // Marks overrides
  let marks: number | null = null;
  if (marksList.length > 0) {
    const parsedMarks = parseInt(marksList[0].trim(), 10);
    if (!isNaN(parsedMarks)) {
      marks = parsedMarks;
    }
  }

  // Difficulty
  let difficulty: 'easy' | 'medium' | 'hard' | null = null;
  if (difficulties.length > 0) {
    const diffRaw = difficulties[0].trim().toLowerCase();
    if (diffRaw === 'easy' || diffRaw === 'medium' || diffRaw === 'hard') {
      difficulty = diffRaw as 'easy' | 'medium' | 'hard';
    }
  }

  const body = cleanQuestionBody(rawBlock);

  return {
    id,
    subject,
    topic,
    answerType,
    marks,
    body,
    options: options.map(opt => opt.trim()),
    correctOption,
    correctValue,
    tolerance,
    modelAnswer,
    difficulty
  };
}
