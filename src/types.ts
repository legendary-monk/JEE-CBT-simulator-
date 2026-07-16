/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AnswerType = 'mcq' | 'numerical' | 'subjective';

export type QuestionState = 
  | 'NOT_VISITED' 
  | 'NOT_ANSWERED' 
  | 'ANSWERED' 
  | 'MARKED_FOR_REVIEW' 
  | 'ANSWERED_AND_MARKED_FOR_REVIEW';

export interface Option {
  id: string;
  questionId: string;
  text: string;
  orderIndex: number;
}

export interface Question {
  id: string; // Q1, Q2, etc.
  subject: string; // Physics, Chemistry, Mathematics, or "Unclassified"
  topic: string; // chapter/topic name or "Unclassified"
  answerType: AnswerType;
  marks: number | null; // optional from file
  body: string; // standard LaTeX body
  options: Option[]; // for MCQ, now array of Option objects
  correctOptionId: string | null; // for MCQ, stable option ID reference
  correctValue: number | null; // for Numerical
  tolerance: number | null; // for Numerical, default 0
  modelAnswer: string | null; // for Subjective
  difficulty: 'easy' | 'medium' | 'hard' | null; // optional
}

export interface Test {
  id: string;
  name: string;
  questions: Question[];
  createdAt: number;
}

export interface QuestionResponse {
  questionId: string;
  answer: string; // selected option, typed text, or numerical string
  timeSpentSeconds: number;
  isMarkedForReview: boolean;
  isAnswered: boolean;
  state: QuestionState;
  
  // Grading-related (filled on submit)
  isCorrect: boolean | null; // null for subjective before self-assessment
  earnedMarks: number | null;
  selfAssessment: 'correct' | 'partial' | 'incorrect' | null; // for subjective
}

export interface Attempt {
  id: string;
  testId: string;
  testName: string;
  candidateName: string;
  startTime: number;
  endTime: number | null; // null if in progress
  timeLeftSeconds: number; // remaining seconds
  examEndTimestamp: number; // absolute end deadline for accurate timer
  responses: Record<string, QuestionResponse>; // key: questionId
  markingScheme: MarkingScheme;
  isSubmitted: boolean;
  tabSwitchCount: number; // to detect fullscreen tab switching
  deviceId?: string;
  lastHeartbeatAt?: number;
}

export interface MarkingScheme {
  preset: 'jee-main' | 'jee-advanced' | 'no-negative' | 'custom';
  mcqPositive: number;
  mcqNegative: number;
  numericalPositive: number;
  numericalNegative: number;
  numericalNoNegative: boolean; // toggle for NAT no-negative variant
  subjectivePositive: number;
  subjectiveNegative: number;
}
