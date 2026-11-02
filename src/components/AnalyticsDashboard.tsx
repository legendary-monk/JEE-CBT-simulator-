/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Attempt, Test, Question } from '../types';
import { LatexRenderer } from './LatexRenderer';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { 
  Trophy, 
  TrendingUp, 
  Clock, 
  Target, 
  BookOpen, 
  AlertOctagon, 
  Gauge, 
  ArrowRight, 
  Sparkles, 
  Calendar, 
  Layers, 
  Trash2,
  GitCompare,
  User,
  Shield,
  HelpCircle,
  TrendingDown,
  Percent,
  Award,
  CheckCircle,
  XCircle,
  Activity,
  AlertTriangle,
  ChevronRight,
  Flame,
  Eye,
  SlidersHorizontal
} from 'lucide-react';

interface AnalyticsDashboardProps {
  attempts: Attempt[];
  tests: Test[];
  onReviewAttempt: (attempt: Attempt) => void;
  onDeleteAttempt: (attemptId: string) => void;
  onLaunchPractice: () => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  attempts,
  tests,
  onReviewAttempt,
  onDeleteAttempt,
  onLaunchPractice,
}) => {
  // Navigation tabs inside Analytics Dashboard
  const [activeTab, setActiveTab] = useState<'individual' | 'comparison'>('individual');

  // Single attempt analysis active choice
  const [selectedAttemptId, setSelectedAttemptId] = useState<string>(
    attempts.length > 0 ? attempts[0].id : ''
  );

  // Comparison selection array (Max 3)
  const [comparedAttemptIds, setComparedAttemptIds] = useState<string[]>(
    attempts.length >= 2 ? [attempts[0].id, attempts[1].id] : attempts.length > 0 ? [attempts[0].id] : []
  );

  // Synchronize selection state cleanly when the attempts collection updates without re-render cascades
  React.useEffect(() => {
    if (attempts.length > 0) {
      setSelectedAttemptId(prev => (attempts.some(a => a.id === prev) ? prev : attempts[0].id));
      setComparedAttemptIds(prev => {
        const validIds = prev.filter(id => attempts.some(a => a.id === id));
        if (validIds.length === 0) {
          return attempts.slice(0, Math.min(2, attempts.length)).map(a => a.id);
        }
        return validIds;
      });
    } else {
      setSelectedAttemptId('');
      setComparedAttemptIds([]);
    }
  }, [attempts]);

  // Heatmap UI state controllers
  const [heatmapSubjectFilter, setHeatmapSubjectFilter] = useState<string>('All');
  const [heatmapViewMode, setHeatmapViewMode] = useState<'questions' | 'topics'>('questions');
  const [heatmapSortOrder, setHeatmapSortOrder] = useState<'id' | 'accuracy-asc' | 'accuracy-desc'>('id');
  const [selectedHeatQuestionId, setSelectedHeatQuestionId] = useState<string | null>(null);

  // Active analyzed individual attempt
  const activeAttempt = useMemo(() => {
    return attempts.find(a => a.id === selectedAttemptId) || attempts[0] || null;
  }, [attempts, selectedAttemptId]);

  // Find matching test for questions structure
  const activeTest = useMemo(() => {
    if (!activeAttempt) return null;
    return tests.find(t => t.id === activeAttempt.testId) || null;
  }, [activeAttempt, tests]);

  // Detailed performance calibration and diagnostics
  const activeAttemptStats = useMemo(() => {
    if (!activeAttempt || !activeTest) return null;

    let totalQuestions = activeTest.questions.length;
    let attemptedCount = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;
    let marksLostToNegative = 0;
    let timeSpentTotal = 0;
    let totalScore = 0;
    let maxScore = 0;

    // To track assessed (non-null) responses for accuracy calibration
    let evaluatedAttemptedCount = 0;

    // Subject stats structure
    const subjectsStats: Record<string, { 
      total: number; 
      attempted: number; 
      correct: number; 
      incorrect: number;
      totalTime: number; 
      maxMarks: number; 
      earnedMarks: number;
      unevaluatedSubjective: number;
    }> = {};

    // Topic stats structure
    const topicsStats: Record<string, { 
      total: number; 
      attempted: number; 
      correct: number; 
      incorrect: number;
      subject: string; 
      totalTime: number;
    }> = {};

    // Answer type stats structure
    const typesStats: Record<string, { total: number; attempted: number; correct: number; incorrect: number }> = {
      mcq: { total: 0, attempted: 0, correct: 0, incorrect: 0 },
      numerical: { total: 0, attempted: 0, correct: 0, incorrect: 0 },
      subjective: { total: 0, attempted: 0, correct: 0, incorrect: 0 },
    };

    let markedCount = 0;
    let markedCorrect = 0;

    activeTest.questions.forEach(q => {
      const resp = activeAttempt.responses[q.id];
      
      // Compute Max possible marks dynamically based on question preset or marking scheme
      const qMaxMarks = q.marks !== null ? q.marks : (
        q.answerType === 'mcq' ? activeAttempt.markingScheme.mcqPositive :
        q.answerType === 'numerical' ? activeAttempt.markingScheme.numericalPositive :
        activeAttempt.markingScheme.subjectivePositive
      );
      maxScore += qMaxMarks;

      // Initialize subject aggregate if missing
      if (!subjectsStats[q.subject]) {
        subjectsStats[q.subject] = { 
          total: 0, 
          attempted: 0, 
          correct: 0, 
          incorrect: 0,
          totalTime: 0, 
          maxMarks: 0, 
          earnedMarks: 0,
          unevaluatedSubjective: 0
        };
      }
      subjectsStats[q.subject].total++;
      subjectsStats[q.subject].maxMarks += qMaxMarks;

      // Initialize topic aggregate if missing
      if (!topicsStats[q.topic]) {
        topicsStats[q.topic] = { total: 0, attempted: 0, correct: 0, incorrect: 0, subject: q.subject, totalTime: 0 };
      }
      topicsStats[q.topic].total++;

      // Increment type aggregates total
      if (typesStats[q.answerType]) {
        typesStats[q.answerType].total++;
      }

      if (!resp) {
        skippedCount++;
        return;
      }

      const isAttempted = resp.answer.trim() !== '';
      const isCorrect = resp.isCorrect === true;
      const isIncorrect = resp.isCorrect === false && isAttempted;
      timeSpentTotal += resp.timeSpentSeconds;
      topicsStats[q.topic].totalTime += resp.timeSpentSeconds;

      if (resp.earnedMarks !== null) {
        totalScore += resp.earnedMarks;
        subjectsStats[q.subject].earnedMarks += resp.earnedMarks;
      } else if (q.answerType === 'subjective' && isAttempted && resp.isCorrect === null) {
        // Unevaluated subjective
        subjectsStats[q.subject].unevaluatedSubjective++;
      }

      subjectsStats[q.subject].totalTime += resp.timeSpentSeconds;

      if (isAttempted) {
        attemptedCount++;
        subjectsStats[q.subject].attempted++;
        topicsStats[q.topic].attempted++;
        typesStats[q.answerType].attempted++;

        // Subjective answers are only evaluated if isCorrect is non-null
        if (resp.isCorrect !== null) {
          evaluatedAttemptedCount++;
        }

        if (isCorrect) {
          correctCount++;
          subjectsStats[q.subject].correct++;
          topicsStats[q.topic].correct++;
          typesStats[q.answerType].correct++;
        } else if (isIncorrect) {
          incorrectCount++;
          subjectsStats[q.subject].incorrect++;
          topicsStats[q.topic].incorrect++;
          typesStats[q.answerType].incorrect++;
          
          if (resp.earnedMarks !== null && resp.earnedMarks < 0) {
            marksLostToNegative += Math.abs(resp.earnedMarks);
          }
        }
      } else {
        skippedCount++;
      }

      if (resp.isMarkedForReview) {
        markedCount++;
        if (isCorrect) {
          markedCorrect++;
        }
      }
    });

    // Calibrate overall accuracy based on evaluated questions to prevent unevaluated subjective from penalizing percentages
    const overallAccuracy = evaluatedAttemptedCount > 0 ? Math.round((correctCount / evaluatedAttemptedCount) * 100) : 0;
    const attemptRate = totalQuestions > 0 ? Math.round((attemptedCount / totalQuestions) * 100) : 0;
    const avgTimePerQuestion = totalQuestions > 0 ? Math.round(timeSpentTotal / totalQuestions) : 0;

    // Time Diagnostic classification: Quadrant analysis
    let swiftSolvers = 0;   // Fast & Correct
    let carefulPlodders = 0; // Slow & Correct
    let rushedErrors = 0;    // Fast & Incorrect
    let stuckLost = 0;       // Slow & Incorrect (Time trap)

    activeTest.questions.forEach(q => {
      const resp = activeAttempt.responses[q.id];
      if (!resp) return;

      const isAttempted = resp.answer.trim() !== '';
      const isCorrect = resp.isCorrect === true;
      const isIncorrect = resp.isCorrect === false && isAttempted;
      const tSpent = resp.timeSpentSeconds;

      if (isAttempted && resp.isCorrect !== null) {
        // Fast is defined as below or equal to the average time spent per question (or 1.1x average)
        const isFast = tSpent <= avgTimePerQuestion;
        if (isCorrect) {
          if (isFast) swiftSolvers++;
          else carefulPlodders++;
        } else if (isIncorrect) {
          if (isFast) rushedErrors++;
          else stuckLost++;
        }
      }
    });

    // Outlier questions (> 1.5x average)
    const outlierQuestions = activeTest.questions.filter(q => {
      const t = activeAttempt.responses[q.id]?.timeSpentSeconds || 0;
      return t > avgTimePerQuestion * 1.5 && t > 25;
    }).map(q => ({
      id: q.id,
      subject: q.subject,
      topic: q.topic,
      timeSpent: activeAttempt.responses[q.id]?.timeSpentSeconds || 0,
      isCorrect: activeAttempt.responses[q.id]?.isCorrect
    }));

    // Predict JEE Percentile dynamically
    let predictedPercentile = 0;
    if (maxScore > 0) {
      const ratio = totalScore / maxScore;
      if (ratio >= 0.85) {
        predictedPercentile = 99.8 + (ratio - 0.85) * 1.33; // 99.8 to 100
      } else if (ratio >= 0.70) {
        predictedPercentile = 99.0 + ((ratio - 0.70) / 0.15) * 0.8; // 99.0 to 99.8
      } else if (ratio >= 0.55) {
        predictedPercentile = 97.0 + ((ratio - 0.55) / 0.15) * 2.0; // 97.0 to 99.0
      } else if (ratio >= 0.40) {
        predictedPercentile = 92.0 + ((ratio - 0.40) / 0.15) * 5.0; // 92.0 to 97.0
      } else if (ratio >= 0.25) {
        predictedPercentile = 80.0 + ((ratio - 0.25) / 0.15) * 12.0; // 80.0 to 92.0
      } else if (ratio >= 0.10) {
        predictedPercentile = 50.0 + ((ratio - 0.10) / 0.15) * 30.0; // 50.0 to 80.0
      } else {
        predictedPercentile = Math.max(12.5, (ratio > 0 ? ratio * 500 : 15.0)); // < 50
      }
      predictedPercentile = Math.min(99.99, Math.round(predictedPercentile * 100) / 100);
    }

    // Guess-Risk and Precision drag indexing
    const totalPotentialScore = totalScore + marksLostToNegative;
    const negativeMarkDragIndex = totalPotentialScore > 0 
      ? Math.round((marksLostToNegative / totalPotentialScore) * 100) 
      : 0;

    return {
      totalQuestions,
      attemptedCount,
      correctCount,
      incorrectCount,
      skippedCount,
      marksLostToNegative,
      negativeMarkDragIndex,
      totalPotentialScore,
      overallAccuracy,
      attemptRate,
      avgTimePerQuestion,
      outlierQuestions,
      subjectsStats,
      topicsStats,
      typesStats,
      markedCount,
      markedCorrect,
      timeSpentTotal,
      totalScore,
      maxScore,
      predictedPercentile,
      timeManagement: {
        swiftSolvers,
        carefulPlodders,
        rushedErrors,
        stuckLost
      }
    };
  }, [activeAttempt, activeTest]);

  // Number of total attempts for this active test
  const testAttemptsCount = useMemo(() => {
    if (!activeTest) return 0;
    return attempts.filter(a => a.testId === activeTest.id).length;
  }, [activeTest, attempts]);

  // Heatmap Data calculations
  const heatmapData = useMemo(() => {
    if (!activeTest || !attempts) return { questionHeat: [], topicHeat: [] };

    const testAttempts = attempts.filter(a => a.testId === activeTest.id);

    // 1. Process Questions
    let processedQuestions = activeTest.questions.map((q, idx) => {
      let attemptedCount = 0;
      let correctCount = 0;
      let incorrectCount = 0;
      let skippedCount = 0;
      let totalTimeSpent = 0;

      testAttempts.forEach(att => {
        const resp = att.responses[q.id];
        if (resp) {
          const isAttempted = resp.answer && resp.answer.trim() !== '';
          if (isAttempted) {
            attemptedCount++;
            totalTimeSpent += resp.timeSpentSeconds;
            if (resp.isCorrect === true) {
              correctCount++;
            } else if (resp.isCorrect === false) {
              incorrectCount++;
            }
          } else {
            skippedCount++;
          }
        } else {
          skippedCount++;
        }
      });

      const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
      const avgTime = attemptedCount > 0 ? Math.round(totalTimeSpent / attemptedCount) : 0;

      return {
        q,
        idx,
        id: q.id,
        subject: q.subject,
        topic: q.topic,
        difficulty: q.difficulty || 'medium',
        accuracy,
        attemptedCount,
        correctCount,
        incorrectCount,
        skippedCount,
        avgTime,
        hasData: attemptedCount > 0,
        answerType: q.answerType,
      };
    });

    // Apply Subject Filter for Questions
    if (heatmapSubjectFilter !== 'All') {
      processedQuestions = processedQuestions.filter(qh => qh.subject.toLowerCase() === heatmapSubjectFilter.toLowerCase());
    }

    // Apply Sorting for Questions
    if (heatmapSortOrder === 'accuracy-asc') {
      processedQuestions.sort((a, b) => {
        if (!a.hasData && b.hasData) return 1;
        if (a.hasData && !b.hasData) return -1;
        return a.accuracy - b.accuracy;
      });
    } else if (heatmapSortOrder === 'accuracy-desc') {
      processedQuestions.sort((a, b) => {
        if (!a.hasData && b.hasData) return 1;
        if (a.hasData && !b.hasData) return -1;
        return b.accuracy - a.accuracy;
      });
    } else {
      // Sort by natural question index order
      processedQuestions.sort((a, b) => a.idx - b.idx);
    }

    // 2. Process Topics
    const topicMap: Record<string, {
      topic: string;
      subject: string;
      questionsCount: number;
      attemptedCount: number;
      correctCount: number;
      incorrectCount: number;
      totalTimeSpent: number;
      questionIds: string[];
    }> = {};

    activeTest.questions.forEach(q => {
      if (!topicMap[q.topic]) {
        topicMap[q.topic] = {
          topic: q.topic,
          subject: q.subject,
          questionsCount: 0,
          attemptedCount: 0,
          correctCount: 0,
          incorrectCount: 0,
          totalTimeSpent: 0,
          questionIds: [],
        };
      }
      topicMap[q.topic].questionsCount++;
      topicMap[q.topic].questionIds.push(q.id);
    });

    testAttempts.forEach(att => {
      activeTest.questions.forEach(q => {
        const resp = att.responses[q.id];
        if (resp) {
          const isAttempted = resp.answer && resp.answer.trim() !== '';
          if (isAttempted) {
            topicMap[q.topic].attemptedCount++;
            topicMap[q.topic].totalTimeSpent += resp.timeSpentSeconds;
            if (resp.isCorrect === true) {
              topicMap[q.topic].correctCount++;
            } else if (resp.isCorrect === false) {
              topicMap[q.topic].incorrectCount++;
            }
          }
        }
      });
    });

    let processedTopics = Object.values(topicMap).map(t => {
      const accuracy = t.attemptedCount > 0 ? Math.round((t.correctCount / t.attemptedCount) * 100) : 0;
      const avgTime = t.attemptedCount > 0 ? Math.round(t.totalTimeSpent / t.attemptedCount) : 0;
      return {
        ...t,
        accuracy,
        avgTime,
        hasData: t.attemptedCount > 0,
      };
    });

    // Apply Subject Filter for Topics
    if (heatmapSubjectFilter !== 'All') {
      processedTopics = processedTopics.filter(th => th.subject.toLowerCase() === heatmapSubjectFilter.toLowerCase());
    }

    // Apply Sorting for Topics (always sorted by accuracy ascending/descending)
    if (heatmapSortOrder === 'accuracy-desc') {
      processedTopics.sort((a, b) => {
        if (!a.hasData && b.hasData) return 1;
        if (a.hasData && !b.hasData) return -1;
        return b.accuracy - a.accuracy;
      });
    } else {
      // Default: weakest first (asc)
      processedTopics.sort((a, b) => {
        if (!a.hasData && b.hasData) return 1;
        if (a.hasData && !b.hasData) return -1;
        return a.accuracy - b.accuracy;
      });
    }

    return { questionHeat: processedQuestions, topicHeat: processedTopics };
  }, [activeTest, attempts, heatmapSubjectFilter, heatmapSortOrder]);

  // Chronological metrics trends for Line charts (safely handling negatives & null subjective checks)
  const historyChartData = useMemo(() => {
    const chronological = [...attempts].reverse();
    return chronological.map((att, index) => {
      let correct = 0;
      let evaluatedAttempted = 0;
      let score = 0;

      Object.values(att.responses).forEach((resp: any) => {
        if (resp.answer.trim() !== '') {
          if (resp.isCorrect !== null) {
            evaluatedAttempted++;
            if (resp.isCorrect === true) {
              correct++;
            }
          }
        }
        if (resp.earnedMarks !== null && resp.earnedMarks !== undefined) {
          score += resp.earnedMarks;
        }
      });

      const accuracy = evaluatedAttempted > 0 ? Math.round((correct / evaluatedAttempted) * 100) : 0;
      return {
        name: `Att #${chronological.length - index}`,
        date: new Date(att.startTime).toLocaleDateString(),
        accuracy,
        score,
        testName: att.testName
      };
    });
  }, [attempts]);

  // Subject accuracy chart data (excluding unevaluated subjective questions)
  const subjectChartData = useMemo(() => {
    if (!activeAttemptStats) return [];
    return Object.entries(activeAttemptStats.subjectsStats).map(([sub, data]: [string, any]) => {
      const evaluatedAttempted = data.correct + data.incorrect;
      const accuracy = evaluatedAttempted > 0 ? Math.round((data.correct / evaluatedAttempted) * 100) : 0;
      const avgTime = data.total > 0 ? Math.round(data.totalTime / data.total) : 0;
      return {
        subject: sub,
        accuracy,
        attempted: data.attempted,
        correct: data.correct,
        total: data.total,
        earnedMarks: data.earnedMarks,
        maxMarks: data.maxMarks,
        avgTime
      };
    });
  }, [activeAttemptStats]);

  // Subject response state distribution chart data
  const subjectDistributionChartData = useMemo(() => {
    if (!activeAttemptStats) return [];
    return Object.entries(activeAttemptStats.subjectsStats).map(([sub]: [string, any]) => {
      let answered = 0;
      let notAnswered = 0;
      let marked = 0;
      let answeredMarked = 0;
      let notVisited = 0;

      if (activeTest) {
        activeTest.questions.forEach(q => {
          if (q.subject !== sub) return;
          const resp = activeAttempt?.responses[q.id];
          if (!resp) {
            notVisited++;
            return;
          }
          if (resp.state === 'NOT_VISITED') notVisited++;
          else if (resp.state === 'NOT_ANSWERED') notAnswered++;
          else if (resp.state === 'ANSWERED') answered++;
          else if (resp.state === 'MARKED_FOR_REVIEW') marked++;
          else if (resp.state === 'ANSWERED_AND_MARKED_FOR_REVIEW') answeredMarked++;
        });
      }

      return {
        subject: sub,
        'Answered': answered,
        'Not Answered': notAnswered,
        'Marked': marked,
        'Ans & Marked': answeredMarked,
        'Not Visited': notVisited,
      };
    });
  }, [activeAttemptStats, activeTest, activeAttempt]);

  // Self assessment marked conversion rate
  const reviewConversionRate = useMemo(() => {
    if (!activeAttemptStats || activeAttemptStats.markedCount === 0) return 0;
    return Math.round((activeAttemptStats.markedCorrect / activeAttemptStats.markedCount) * 100);
  }, [activeAttemptStats]);

  // Handler to toggle compare selections (max 3)
  const toggleCompareAttempt = (id: string) => {
    setComparedAttemptIds(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  // Compile detailed stats for compared attempts
  const comparisonData = useMemo(() => {
    return comparedAttemptIds.map((id, index) => {
      const att = attempts.find(a => a.id === id);
      if (!att) return null;

      const t = tests.find(test => test.id === att.testId);
      const totalQuestions = t ? t.questions.length : 0;
      
      let score = 0;
      let correct = 0;
      let attempted = 0;
      let evaluatedAttempted = 0;
      let incorrect = 0;
      let timeSpent = 0;
      let physicsCorrect = 0, physicsAttempted = 0, physicsEvaluated = 0;
      let chemistryCorrect = 0, chemistryAttempted = 0, chemistryEvaluated = 0;
      let mathsCorrect = 0, mathsAttempted = 0, mathsEvaluated = 0;

      Object.values(att.responses).forEach((resp: any) => {
        timeSpent += resp.timeSpentSeconds;
        const isAttempted = resp.answer.trim() !== '';
        if (isAttempted) {
          attempted++;
          if (resp.isCorrect !== null) {
            evaluatedAttempted++;
            if (resp.isCorrect === true) {
              correct++;
            } else if (resp.isCorrect === false) {
              incorrect++;
            }
          }
        }
        if (resp.earnedMarks !== null && resp.earnedMarks !== undefined) {
          score += resp.earnedMarks;
        }
      });

      // Split subject metrics
      if (t) {
        t.questions.forEach(q => {
          const resp = att.responses[q.id];
          if (resp && resp.answer.trim() !== '') {
            if (q.subject === 'Physics') {
              physicsAttempted++;
              if (resp.isCorrect !== null) {
                physicsEvaluated++;
                if (resp.isCorrect === true) physicsCorrect++;
              }
            } else if (q.subject === 'Chemistry') {
              chemistryAttempted++;
              if (resp.isCorrect !== null) {
                chemistryEvaluated++;
                if (resp.isCorrect === true) chemistryCorrect++;
              }
            } else if (q.subject === 'Mathematics') {
              mathsAttempted++;
              if (resp.isCorrect !== null) {
                mathsEvaluated++;
                if (resp.isCorrect === true) mathsCorrect++;
              }
            }
          }
        });
      }

      const overallAccuracy = evaluatedAttempted > 0 ? Math.round((correct / evaluatedAttempted) * 100) : 0;
      const attemptRate = totalQuestions > 0 ? Math.round((attempted / totalQuestions) * 100) : 0;
      const avgPacing = totalQuestions > 0 ? Math.round(timeSpent / totalQuestions) : 0;

      return {
        id: att.id,
        label: `Attempt #${attempts.length - attempts.findIndex(a => a.id === id)}`,
        testName: att.testName,
        candidate: att.candidateName,
        date: new Date(att.startTime).toLocaleDateString(),
        score,
        correct,
        incorrect,
        attempted,
        totalQuestions,
        overallAccuracy,
        attemptRate,
        avgPacing,
        tabSwitches: att.tabSwitchCount,
        subjects: {
          Physics: physicsEvaluated > 0 ? Math.round((physicsCorrect / physicsEvaluated) * 100) : 0,
          Chemistry: chemistryEvaluated > 0 ? Math.round((chemistryCorrect / chemistryEvaluated) * 100) : 0,
          Mathematics: mathsEvaluated > 0 ? Math.round((mathsCorrect / mathsEvaluated) * 100) : 0,
        }
      };
    }).filter(Boolean);
  }, [comparedAttemptIds, attempts, tests]);

  // Grouped subject accuracy data for Comparison Chart
  const groupedComparisonChartData = useMemo(() => {
    if (comparisonData.length === 0) return [];
    const subjects = ['Physics', 'Chemistry', 'Mathematics'];
    return subjects.map(sub => {
      const item: any = { subject: sub };
      comparisonData.forEach(cd => {
        if (cd) {
          item[cd.label] = cd.subjects[sub as keyof typeof cd.subjects] || 0;
        }
      });
      return item;
    });
  }, [comparisonData]);

  // Comparison summary card autoinsights
  const comparisonInsights = useMemo(() => {
    if (comparisonData.length < 2) return null;
    let highestScore = -Infinity;
    let highestScoreLabel = '';
    let bestAccuracy = -1;
    let bestAccuracyLabel = '';
    let fastestPacing = Infinity;
    let fastestPacingLabel = '';
    let mostSecure = Infinity;
    let mostSecureLabel = '';

    comparisonData.forEach(cd => {
      if (cd) {
        if (cd.score > highestScore) {
          highestScore = cd.score;
          highestScoreLabel = cd.label;
        }
        if (cd.overallAccuracy > bestAccuracy) {
          bestAccuracy = cd.overallAccuracy;
          bestAccuracyLabel = cd.label;
        }
        if (cd.avgPacing < fastestPacing) {
          fastestPacing = cd.avgPacing;
          fastestPacingLabel = cd.label;
        }
        if (cd.tabSwitches < mostSecure) {
          mostSecure = cd.tabSwitches;
          mostSecureLabel = cd.label;
        }
      }
    });

    return {
      highestScore: { val: highestScore, label: highestScoreLabel },
      bestAccuracy: { val: bestAccuracy, label: bestAccuracyLabel },
      fastestPacing: { val: fastestPacing, label: fastestPacingLabel },
      mostSecure: { val: mostSecure, label: mostSecureLabel }
    };
  }, [comparisonData]);

  if (attempts.length === 0) {
    return (
      <div className="max-w-xl mx-auto bg-graphite border border-instrument-steel/20 rounded-xl p-12 text-center space-y-6 my-12 animate-fade-in" id="analytics-empty">
        <div className="p-4 bg-blueprint-bg text-circuit-amber border border-instrument-steel/20 rounded-full inline-block">
          <Trophy className="w-12 h-12" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-serif font-bold text-chalk-white">Your Practice Performance Arena</h2>
          <p className="text-sm text-instrument-steel leading-relaxed">
            There are no saved exam sessions in your local database. Complete a CBT simulation paper to see your topic-wise weakness analysis, accuracy trend curves, and speed outliers.
          </p>
        </div>
        <button
          onClick={onLaunchPractice}
          className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-circuit-amber hover:bg-circuit-amber/90 text-blueprint-bg rounded font-mono text-xs font-bold transition duration-150 cursor-pointer shadow-md"
        >
          <Sparkles className="w-4 h-4" />
          LAUNCH CBT ARENA
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pb-12 animate-fade-in" id="analytics-dashboard-root">
      
      {/* Selector & Navigation Tab Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-graphite p-5 rounded-xl border border-instrument-steel/20 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-serif font-bold text-chalk-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-circuit-amber" />
            Accuracy & Calibration Dashboard
          </h1>
          <p className="text-xs text-instrument-steel">
            Real-time diagnostics engine fueled exclusively by your persistent client-side IndexedDB logs.
          </p>
        </div>

        {/* Tab triggers */}
        <div className="flex bg-blueprint-bg p-1 rounded-lg border border-instrument-steel/20 font-mono w-full md:w-auto">
          <button
            onClick={() => setActiveTab('individual')}
            className={`flex-1 md:flex-initial px-4 py-1.5 text-[10px] font-bold rounded transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-circuit-amber ${
              activeTab === 'individual'
                ? 'bg-graphite text-circuit-amber border border-instrument-steel/30 shadow-sm'
                : 'text-instrument-steel hover:text-chalk-white border border-transparent'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            SINGLE ATTEMPT DIAGNOSTICS
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`flex-1 md:flex-initial px-4 py-1.5 text-[10px] font-bold rounded transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-circuit-amber ${
              activeTab === 'comparison'
                ? 'bg-graphite text-circuit-amber border border-instrument-steel/30 shadow-sm'
                : 'text-instrument-steel hover:text-chalk-white border border-transparent'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            COMPARE ATTEMPTS ({comparedAttemptIds.length})
          </button>
        </div>
      </div>

      {/* -------------------- INDIVIDUAL ANALYSIS VIEW -------------------- */}
      {activeTab === 'individual' && activeAttemptStats && activeAttempt && (
        <>
          {/* Attempt Selector Dropdown inside Individual view */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-graphite/40 p-4 border border-instrument-steel/20 rounded-xl gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-instrument-steel" />
              <span className="text-xs font-mono font-bold text-instrument-steel uppercase tracking-wider">Analyze Attempt Profile:</span>
            </div>
            <select
              value={selectedAttemptId}
              onChange={(e) => setSelectedAttemptId(e.target.value)}
              className="w-full sm:w-auto text-xs font-mono px-3 py-1.5 border border-instrument-steel/30 rounded bg-blueprint-bg text-chalk-white outline-none focus:border-circuit-amber transition duration-150 max-w-full sm:max-w-md cursor-pointer animate-fade-in"
            >
              {attempts.map((att, idx) => (
                <option key={att.id} value={att.id}>
                  Attempt #{attempts.length - idx} ({new Date(att.startTime).toLocaleDateString()}) — {att.testName}
                </option>
              ))}
            </select>
          </div>

          {/* Headline metric group: accuracy focused bento grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Predicted Percentile Gauge */}
            <div className="bg-graphite border border-instrument-steel/30 rounded-xl p-5 shadow-sm flex flex-col justify-between min-h-[180px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-instrument-steel">
                  ESTIMATED PERCENTILE
                </span>
                <Gauge className="w-4 h-4 text-circuit-amber" />
              </div>
              <div className="space-y-1">
                <span className="text-4xl font-mono font-black text-chalk-white block">
                  {activeAttemptStats.predictedPercentile}
                </span>
                <span className="text-[10px] font-mono text-instrument-steel block uppercase tracking-wider">
                  PREDICTED JEE MAIN RANK INDEX
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="w-full bg-blueprint-bg rounded-full h-2 overflow-hidden border border-instrument-steel/10">
                  <div 
                    className="bg-circuit-amber h-full rounded-full" 
                    style={{ width: `${Math.min(100, Math.max(15, activeAttemptStats.predictedPercentile))}%` }} 
                  />
                </div>
                <div className="flex justify-between text-[8px] font-mono text-instrument-steel">
                  <span>75 %ile</span>
                  <span>95 %ile</span>
                  <span>99 %ile</span>
                  <span>99.9 %ile</span>
                </div>
              </div>
            </div>

            {/* Score Summary Board */}
            <div className="bg-graphite border border-instrument-steel/20 rounded-xl p-5 shadow-sm flex flex-col justify-between min-h-[180px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-instrument-steel">
                  TOTAL EVALUATED SCORE
                </span>
                <Award className="w-4 h-4 text-circuit-amber" />
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-mono font-black text-circuit-amber">
                    {activeAttemptStats.totalScore}
                  </span>
                  <span className="text-sm font-mono text-instrument-steel">
                    / {activeAttemptStats.maxScore} Marks
                  </span>
                </div>
                <span className="text-[10px] font-mono text-instrument-steel block uppercase tracking-wider">
                  AGGREGATED MARKS SECURED
                </span>
              </div>
              <p className="text-[10px] text-instrument-steel leading-relaxed font-mono">
                Overall efficiency rate: <span className="font-semibold text-chalk-white">
                  {activeAttemptStats.maxScore > 0 ? Math.round((activeAttemptStats.totalScore / activeAttemptStats.maxScore) * 100) : 0}%
                </span> of full marks.
              </p>
            </div>

            {/* Accuracy & Calibration Gauge */}
            <div className="bg-graphite border border-instrument-steel/20 rounded-xl p-5 shadow-sm flex flex-col justify-between min-h-[180px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-instrument-steel">
                  ACCURACY RATE
                </span>
                <Target className="w-4 h-4 text-formula-green" />
              </div>
              <div className="space-y-1">
                <span className="text-4xl font-mono font-black text-chalk-white block">
                  {activeAttemptStats.overallAccuracy}%
                </span>
                <span className="text-[10px] font-mono text-instrument-steel block uppercase tracking-wider">
                  CORRECTNESS OF ANSWERS
                </span>
              </div>
              <p className="text-[10px] text-instrument-steel leading-relaxed font-mono">
                Secured <span className="text-formula-green font-bold">{activeAttemptStats.correctCount} OK</span> vs <span className="text-red-400 font-bold">{activeAttemptStats.incorrectCount} ERR</span> out of <span className="text-chalk-white font-bold">{activeAttemptStats.attemptedCount} attempted</span>.
              </p>
            </div>

            {/* Speed & Pacing Diagnostics */}
            <div className="bg-graphite border border-instrument-steel/20 rounded-xl p-5 shadow-sm flex flex-col justify-between min-h-[180px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-instrument-steel">
                  ANSWERING SPEED
                </span>
                <Clock className="w-4 h-4 text-circuit-amber animate-pulse" />
              </div>
              <div className="space-y-1">
                <span className="text-4xl font-mono font-black text-chalk-white block">
                  {activeAttemptStats.avgTimePerQuestion}s
                </span>
                <span className="text-[10px] font-mono text-instrument-steel block uppercase tracking-wider">
                  AVERAGE PACE PER QUESTION
                </span>
              </div>
              <p className="text-[10px] text-instrument-steel leading-relaxed font-mono">
                Total duration spent: <span className="text-chalk-white font-bold">{Math.round(activeAttemptStats.timeSpentTotal / 60)} mins</span> on a <span className="text-chalk-white font-bold">{activeAttemptStats.totalQuestions}Q</span> paper.
              </p>
            </div>

          </div>

          {/* Strategic Accuracy & Guess-Risk Diagnostic Panel */}
          <div className="bg-graphite rounded-xl border border-instrument-steel/20 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-instrument-steel/10 gap-2">
              <div>
                <h3 className="text-xs font-mono font-bold text-chalk-white uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-circuit-amber" />
                  PRECISION & GUESS-RISK STRATEGY DIAGNOSTICS
                </h3>
                <p className="text-[10px] text-instrument-steel font-mono mt-0.5">
                  Analyzing mark leakage through incorrect responses and negative marking penalties
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-blueprint-bg text-circuit-amber border border-circuit-amber/10 rounded uppercase">
                Tactical Insights
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Negative Marking Drag Indicator */}
              <div className="bg-blueprint-bg/30 border border-instrument-steel/10 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-instrument-steel uppercase tracking-wider">Negative Mark Drag Index</span>
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-mono font-black ${activeAttemptStats.negativeMarkDragIndex > 15 ? 'text-red-400' : 'text-formula-green'}`}>
                      {activeAttemptStats.negativeMarkDragIndex}%
                    </span>
                    <span className="text-[10px] font-mono text-instrument-steel">score leakage</span>
                  </div>
                  <div className="w-full bg-graphite rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${activeAttemptStats.negativeMarkDragIndex > 15 ? 'bg-red-500' : 'bg-formula-green'}`} 
                      style={{ width: `${Math.min(100, activeAttemptStats.negativeMarkDragIndex)}%` }} 
                    />
                  </div>
                </div>
                <p className="text-[10px] text-instrument-steel leading-relaxed font-mono">
                  You lost <strong className="text-red-400">-{activeAttemptStats.marksLostToNegative} marks</strong> to negative marking. Your potential score without penalty was <strong className="text-chalk-white">{activeAttemptStats.totalPotentialScore}</strong>.
                </p>
              </div>

              {/* Answering Precision */}
              <div className="bg-blueprint-bg/30 border border-instrument-steel/10 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-instrument-steel uppercase tracking-wider">Answering Precision Quotient</span>
                  <Target className="w-4 h-4 text-formula-green" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-mono font-black text-chalk-white">
                      {Math.round((activeAttemptStats.correctCount / (activeAttemptStats.correctCount + activeAttemptStats.incorrectCount || 1)) * 100)}%
                    </span>
                    <span className="text-[10px] font-mono text-instrument-steel">precision rate</span>
                  </div>
                  <div className="w-full bg-graphite rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-formula-green h-full rounded-full" 
                      style={{ width: `${Math.round((activeAttemptStats.correctCount / (activeAttemptStats.correctCount + activeAttemptStats.incorrectCount || 1)) * 100)}%` }} 
                    />
                  </div>
                </div>
                <p className="text-[10px] text-instrument-steel leading-relaxed font-mono">
                  Ratio of correct responses to total evaluated attempts. High quotients indicate high selectivity and minimal blind guessing.
                </p>
              </div>

              {/* Strategic Guidance text */}
              <div className="bg-blueprint-bg/30 border border-instrument-steel/10 rounded-xl p-4 flex flex-col justify-between space-y-2">
                <span className="text-[10px] font-mono font-bold text-circuit-amber uppercase tracking-wider">TACTICAL RECOMMENDATION</span>
                <p className="text-[10px] text-instrument-steel leading-relaxed font-mono">
                  {activeAttemptStats.negativeMarkDragIndex > 15 ? (
                    <span className="text-red-200">
                      ⚠️ <strong className="text-red-400">High Penalty Drag:</strong> You are losing too many marks to negative penalties. Limit MCQ guessing on doubtful topics and focus on increasing step accuracy in Numerical Answer Type questions.
                    </span>
                  ) : activeAttemptStats.overallAccuracy > 80 ? (
                    <span className="text-emerald-200">
                      ✨ <strong className="text-emerald-400">Elite Precision:</strong> Your response selection is extremely precise. You can strategically afford to attempt slightly more borderline/marked questions to push your percentile to the highest tier.
                    </span>
                  ) : (
                    <span className="text-chalk-white">
                      👍 <strong className="text-circuit-amber">Balanced Risk:</strong> Your guess-risk drag is healthy. Focus on pacing calibration to minimize <strong className="text-red-400">Stuck & Lost</strong> time-traps, which drain your velocity.
                    </span>
                  )}
                </p>
                <div className="text-[9px] text-instrument-steel border-t border-instrument-steel/5 pt-1.5 font-mono">
                  Based on attempt #{attempts.length - attempts.findIndex(a => a.id === selectedAttemptId)} behavior.
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Subject-Wise Scoreboard */}
          <div className="bg-graphite rounded-xl border border-instrument-steel/20 shadow-sm overflow-hidden p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-instrument-steel/10">
              <h3 className="text-xs font-mono font-bold text-chalk-white uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-circuit-amber" />
                SUBJECT PERFORMANCE MATRIX
              </h3>
              <span className="text-[10px] font-mono text-instrument-steel">Calibrated sub-score breakdown</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {subjectChartData.map((subData) => {
                const isPhys = subData.subject === 'Physics';
                const isChem = subData.subject === 'Chemistry';
                const subColor = isPhys ? 'text-blue-400' : isChem ? 'text-emerald-400' : 'text-amber-400';
                const barBg = isPhys ? 'bg-blue-500' : isChem ? 'bg-emerald-500' : 'bg-amber-500';
                const ratio = subData.maxMarks > 0 ? (subData.earnedMarks / subData.maxMarks) * 100 : 0;
                
                // Get subject stats from raw aggregate
                const rawSub = activeAttemptStats.subjectsStats[subData.subject] || { unevaluatedSubjective: 0, incorrect: 0 };

                return (
                  <div key={subData.subject} className="bg-blueprint-bg/40 border border-instrument-steel/10 rounded-xl p-4 flex flex-col justify-between space-y-4">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-serif font-black ${subColor}`}>{subData.subject}</span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-graphite/60 border border-instrument-steel/20 rounded text-chalk-white">
                        {subData.accuracy}% Acc
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-instrument-steel">Sub Score:</span>
                        <span className="font-extrabold text-chalk-white">{subData.earnedMarks} / {subData.maxMarks}</span>
                      </div>
                      <div className="w-full bg-graphite rounded-full h-2 overflow-hidden">
                        <div className={`h-full rounded-full ${barBg}`} style={{ width: `${Math.max(0, ratio)}%` }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 font-mono text-[10px] text-center">
                      <div className="bg-graphite/40 border border-instrument-steel/10 p-1.5 rounded">
                        <span className="text-instrument-steel block text-[8px] uppercase">Attempted</span>
                        <span className="font-bold text-chalk-white">{subData.attempted} / {subData.total}</span>
                      </div>
                      <div className="bg-graphite/40 border border-instrument-steel/10 p-1.5 rounded">
                        <span className="text-instrument-steel block text-[8px] uppercase">Correct</span>
                        <span className="font-bold text-formula-green">{subData.correct}</span>
                      </div>
                      <div className="bg-graphite/40 border border-instrument-steel/10 p-1.5 rounded">
                        <span className="text-instrument-steel block text-[8px] uppercase">Incorrect</span>
                        <span className="font-bold text-red-400">{rawSub.incorrect}</span>
                      </div>
                    </div>

                    <div className="border-t border-instrument-steel/10 pt-2 flex justify-between items-center text-[10px] font-mono text-instrument-steel">
                      <span>Avg Pace: <strong className="text-chalk-white">{subData.avgTime}s/Q</strong></span>
                      {rawSub.unevaluatedSubjective > 0 && (
                        <span className="text-circuit-amber animate-pulse font-bold">
                          {rawSub.unevaluatedSubjective} subjective pending
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dual Diagnostic Graphs Area */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Subject Response Distribution Bar Chart */}
            <div className="bg-graphite p-5 rounded-xl border border-instrument-steel/20 shadow-sm space-y-4">
              <h3 className="text-xs font-mono font-bold text-chalk-white uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-circuit-amber" />
                Response Distribution Topography
              </h3>
              
              {subjectDistributionChartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjectDistributionChartData} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#7C8B99" opacity={0.15} />
                      <XAxis dataKey="subject" stroke="#7C8B99" fontSize={11} tickLine={false} fontFamily="IBM Plex Mono" />
                      <YAxis stroke="#7C8B99" fontSize={11} tickLine={false} fontFamily="IBM Plex Mono" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1B2733', borderColor: '#7C8B99', borderRadius: '4px', color: '#EDEFF2', fontSize: '11px', fontFamily: 'IBM Plex Mono' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '5px', fontFamily: 'IBM Plex Mono' }} />
                      <Bar dataKey="Answered" stackId="a" fill="#4C9A6A" />
                      <Bar dataKey="Not Answered" stackId="a" fill="#7C8B99" />
                      <Bar dataKey="Marked" stackId="a" fill="#F2A93B" />
                      <Bar dataKey="Ans & Marked" stackId="a" fill="#3B82F6" />
                      <Bar dataKey="Not Visited" stackId="a" fill="#1e293b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-instrument-steel text-xs font-mono">No metrics recorded</div>
              )}
            </div>

            {/* Dynamic Attempt Curve (Historical Progression) */}
            <div className="bg-graphite p-5 rounded-xl border border-instrument-steel/20 shadow-sm space-y-4">
              <h3 className="text-xs font-mono font-bold text-chalk-white uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-circuit-amber" />
                Multi-Session Accuracy & Score Curve
              </h3>

              {historyChartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#7C8B99" opacity={0.15} />
                      <XAxis dataKey="name" stroke="#7C8B99" fontSize={11} tickLine={false} fontFamily="IBM Plex Mono" />
                      <YAxis yAxisId="left" stroke="#7C8B99" fontSize={11} tickLine={false} domain={[0, 100]} fontFamily="IBM Plex Mono" />
                      <YAxis yAxisId="right" orientation="right" stroke="#7C8B99" fontSize={11} tickLine={false} fontFamily="IBM Plex Mono" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1B2733', borderColor: '#7C8B99', borderRadius: '4px', color: '#EDEFF2', fontSize: '11px', fontFamily: 'IBM Plex Mono' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '5px', fontFamily: 'IBM Plex Mono' }} />
                      <Line yAxisId="left" type="monotone" name="Accuracy (%)" dataKey="accuracy" stroke="#4C9A6A" strokeWidth={2.5} dot={{ r: 4, fill: '#4C9A6A' }} activeDot={{ r: 6 }} />
                      <Line yAxisId="right" type="monotone" name="Marks Secured" dataKey="score" stroke="#F2A93B" strokeWidth={2.5} dot={{ r: 4, fill: '#F2A93B' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-instrument-steel text-xs font-mono">No attempt history yet</div>
              )}
            </div>

          </div>

          {/* Time Management Diagnostics Grid (Quadrants) & Question Outliers */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Speed vs Accuracy Quadrants Dashboard */}
            <div className="bg-graphite p-5 rounded-xl border border-instrument-steel/20 shadow-sm space-y-4 lg:col-span-1">
              <div className="border-b border-instrument-steel/10 pb-2">
                <h3 className="text-xs font-mono font-bold text-chalk-white uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-circuit-amber" />
                  PACE VS CALIBRATION MATRIX
                </h3>
                <span className="text-[9px] font-mono text-instrument-steel">Diagnosing student tactical behavior</span>
              </div>

              <div className="grid grid-cols-2 gap-2 h-56 font-mono text-center">
                {/* Swift Solvers: Fast & Correct */}
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl flex flex-col justify-center items-center space-y-1">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span className="text-lg font-black text-emerald-400">{activeAttemptStats.timeManagement.swiftSolvers}</span>
                  <span className="text-[8px] text-emerald-500 font-extrabold uppercase tracking-wide">Swift Solvers</span>
                  <span className="text-[7px] text-instrument-steel">Fast & Correct (Ideal)</span>
                </div>

                {/* Careful Plodders: Slow & Correct */}
                <div className="p-3 bg-blue-950/20 border border-blue-900/30 rounded-xl flex flex-col justify-center items-center space-y-1">
                  <CheckCircle className="w-5 h-5 text-blue-400" />
                  <span className="text-lg font-black text-blue-400">{activeAttemptStats.timeManagement.carefulPlodders}</span>
                  <span className="text-[8px] text-blue-500 font-extrabold uppercase tracking-wide">Careful Plodders</span>
                  <span className="text-[7px] text-instrument-steel">Slow & Correct (Verify speed)</span>
                </div>

                {/* Rushed Errors: Fast & Incorrect */}
                <div className="p-3 bg-amber-950/20 border border-amber-900/30 rounded-xl flex flex-col justify-center items-center space-y-1">
                  <XCircle className="w-5 h-5 text-amber-400" />
                  <span className="text-lg font-black text-circuit-amber">{activeAttemptStats.timeManagement.rushedErrors}</span>
                  <span className="text-[8px] text-circuit-amber font-extrabold uppercase tracking-wide">Rushed Errors</span>
                  <span className="text-[7px] text-instrument-steel">Fast & Wrong (Silly gaps)</span>
                </div>

                {/* Stuck & Lost: Slow & Incorrect */}
                <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-xl flex flex-col justify-center items-center space-y-1">
                  <XCircle className="w-5 h-5 text-red-400" />
                  <span className="text-lg font-black text-red-400">{activeAttemptStats.timeManagement.stuckLost}</span>
                  <span className="text-[8px] text-red-400 font-extrabold uppercase tracking-wide">Stuck & Lost</span>
                  <span className="text-[7px] text-instrument-steel">Slow & Wrong (Time sink)</span>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[9px] font-mono text-instrument-steel leading-normal">
                  *<strong>Stuck & Lost</strong> queries signify concepts where you spent valuable time but still evaluated incorrect. Revise these core chapters immediately.
                </p>
              </div>
            </div>

            {/* Time Traps and Stuck-Outliers Questions Log */}
            <div className="bg-graphite p-5 rounded-xl border border-instrument-steel/20 shadow-sm space-y-4 lg:col-span-2 flex flex-col justify-between">
              <div>
                <div className="border-b border-instrument-steel/10 pb-2 mb-2">
                  <h3 className="text-xs font-mono font-bold text-chalk-white uppercase tracking-wider flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4 text-circuit-amber" />
                    EXAM TIME TRAPS & PACE OUTLIERS
                  </h3>
                  <span className="text-[9px] font-mono text-instrument-steel">Questions where you spent &gt; 1.5x average duration</span>
                </div>

                {activeAttemptStats.outlierQuestions.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {activeAttemptStats.outlierQuestions.map(out => {
                      const statusColor = out.isCorrect === true 
                        ? 'border-emerald-950/50 bg-emerald-950/20 text-emerald-400' 
                        : out.isCorrect === false 
                          ? 'border-red-950/50 bg-red-950/20 text-red-400' 
                          : 'border-yellow-950/50 bg-yellow-950/20 text-circuit-amber';
                      const statusLabel = out.isCorrect === true 
                        ? 'Correct' 
                        : out.isCorrect === false 
                          ? 'Incorrect' 
                          : 'Unassessed';

                      return (
                        <div key={out.id} className={`flex items-center justify-between p-2 border rounded-lg text-xs font-mono ${statusColor}`}>
                          <div>
                            <span className="font-extrabold text-chalk-white">Question {out.id}</span>
                            <span className="text-[10px] text-instrument-steel ml-2">({out.subject} • {out.topic})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold uppercase">{statusLabel}</span>
                            <span className="bg-graphite px-2 py-0.5 border border-instrument-steel/20 rounded font-bold text-chalk-white">{out.timeSpent}s spent</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-instrument-steel text-xs font-mono italic">
                    No critical time-traps detected! Your pacing remained highly uniform throughout.
                  </div>
                )}
              </div>

              {/* Review conversion stats */}
              <div className="pt-4 border-t border-instrument-steel/10 flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 w-full space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="font-bold text-instrument-steel uppercase tracking-wider">REVIEW INTUITION CALIBRATION:</span>
                    <span className="font-bold text-circuit-amber">{reviewConversionRate}%</span>
                  </div>
                  <div className="w-full bg-blueprint-bg rounded-full h-1.5 overflow-hidden">
                    <div className="bg-circuit-amber h-1.5 rounded-full" style={{ width: `${reviewConversionRate}%` }} />
                  </div>
                </div>
                <p className="text-[9px] font-mono text-instrument-steel leading-normal max-w-sm">
                  Out of <strong className="text-chalk-white">{activeAttemptStats.markedCount} flagged questions</strong>, <strong className="text-formula-green">{activeAttemptStats.markedCorrect} evaluated correct</strong>. High calibration ratios indicate robust test confidence.
                </p>
              </div>

            </div>

          </div>

          {/* Interactive Chapter / Topic Mastery & Revision Heatmap */}
          <div className="bg-graphite rounded-xl border border-instrument-steel/20 shadow-sm p-5 space-y-4">
            <div className="border-b border-instrument-steel/10 pb-2">
              <h3 className="text-xs font-mono font-bold text-chalk-white uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-circuit-amber" />
                CHAPTER-WISE WEAKNESS & MASTERY CALIBRATION
              </h3>
              <p className="text-[10px] text-instrument-steel font-mono mt-1">
                Chapters ranked by revision priority (weakest chapters listed first)
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto pr-1">
              {Object.entries(activeAttemptStats.topicsStats)
                .map(([name, data]: [string, any]) => {
                  const evaluatedCount = data.correct + data.incorrect;
                  const accuracy = evaluatedCount > 0 ? Math.round((data.correct / evaluatedCount) * 100) : 0;
                  const avgTime = data.attempted > 0 ? Math.round(data.totalTime / data.attempted) : 0;
                  return { name, accuracy, avgTime, evaluatedCount, ...data };
                })
                .sort((a, b) => {
                  // Put topics with attempts and lowest accuracy at the top
                  if (a.attempted > 0 && b.attempted === 0) return -1;
                  if (a.attempted === 0 && b.attempted > 0) return 1;
                  return a.accuracy - b.accuracy;
                })
                .map((topic) => {
                  const hasAttempt = topic.attempted > 0;
                  const isRed = hasAttempt && topic.accuracy < 50;
                  const isAmber = hasAttempt && topic.accuracy >= 50 && topic.accuracy < 75;
                  const isGreen = hasAttempt && topic.accuracy >= 75;

                  const badgeClass = isRed 
                    ? 'bg-red-950/30 text-red-400 border border-red-900/30' 
                    : isAmber 
                      ? 'bg-yellow-950/30 text-circuit-amber border border-yellow-900/30' 
                      : isGreen 
                        ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/30' 
                        : 'bg-blueprint-bg/40 text-instrument-steel border border-instrument-steel/10';

                  const badgeLabel = isRed 
                    ? 'Critical Revision' 
                    : isAmber 
                      ? 'Improvement Needed' 
                      : isGreen 
                        ? 'Mastered' 
                        : 'No Data';

                  return (
                    <div key={topic.name} className="bg-blueprint-bg/25 border border-instrument-steel/15 p-3 rounded-xl flex flex-col justify-between space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[8px] font-mono text-instrument-steel uppercase tracking-wide block">{topic.subject}</span>
                          <span className="text-xs font-bold text-chalk-white line-clamp-1 mt-0.5">{topic.name}</span>
                        </div>
                        <span className={`text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded ${badgeClass}`}>
                          {badgeLabel}
                        </span>
                      </div>

                      {hasAttempt ? (
                        <div className="space-y-1 font-mono text-[10px]">
                          <div className="flex justify-between">
                            <span className="text-instrument-steel">Mastery Accuracy:</span>
                            <span className="font-extrabold text-chalk-white">{topic.accuracy}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-instrument-steel">Correct/Attempted:</span>
                            <span className="text-chalk-white">{topic.correct} / {topic.attempted}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-instrument-steel">Average Pacing:</span>
                            <span className="text-chalk-white">{topic.avgTime}s / Question</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-2 text-instrument-steel text-[10px] font-mono italic">
                          No questions attempted on this chapter
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* ACCURACY PERFORMANCE HEATMAP */}
          <div className="bg-graphite rounded-xl border border-instrument-steel/20 shadow-sm p-5 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-3 border-b border-instrument-steel/10 gap-3">
              <div className="space-y-1">
                <h3 className="text-xs font-mono font-bold text-chalk-white uppercase tracking-wider flex items-center gap-2">
                  <Flame className="w-4 h-4 text-red-500 animate-pulse" />
                  ACCURACY PERFORMANCE HEATMAP (CONCEPT WEAKNESS DIAGNOSTICS)
                </h3>
                <p className="text-[10px] text-instrument-steel font-mono leading-relaxed">
                  Interactive multi-session diagnostic grid. Cells are heat-mapped by correct answer ratios. Select a question to view the exact LaTeX formula, correct keys, and pacing metrics.
                </p>
              </div>

              {/* Filtering & View Mode Controls */}
              <div className="flex flex-wrap gap-2.5 items-center">
                {/* View Mode Toggle */}
                <div className="bg-blueprint-bg p-0.5 rounded border border-instrument-steel/15 flex text-[10px] font-mono">
                  <button
                    onClick={() => {
                      setHeatmapViewMode('questions');
                      setSelectedHeatQuestionId(null);
                    }}
                    className={`px-2.5 py-1 rounded transition font-bold cursor-pointer ${
                      heatmapViewMode === 'questions'
                        ? 'bg-graphite text-circuit-amber shadow-xs'
                        : 'text-instrument-steel hover:text-chalk-white'
                    }`}
                  >
                    Question-Wise
                  </button>
                  <button
                    onClick={() => setHeatmapViewMode('topics')}
                    className={`px-2.5 py-1 rounded transition font-bold cursor-pointer ${
                      heatmapViewMode === 'topics'
                        ? 'bg-graphite text-circuit-amber shadow-xs'
                        : 'text-instrument-steel hover:text-chalk-white'
                    }`}
                  >
                    Topic-Wise
                  </button>
                </div>

                {/* Subject Filter Dropdown */}
                <div className="flex items-center gap-1 bg-blueprint-bg px-2.5 py-1 rounded border border-instrument-steel/15 text-[10px] font-mono text-instrument-steel">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <select
                    value={heatmapSubjectFilter}
                    onChange={(e) => {
                      setHeatmapSubjectFilter(e.target.value);
                      setSelectedHeatQuestionId(null);
                    }}
                    className="bg-transparent border-none text-chalk-white font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="All" className="bg-graphite">All Subjects</option>
                    <option value="Physics" className="bg-graphite">Physics</option>
                    <option value="Chemistry" className="bg-graphite">Chemistry</option>
                    <option value="Mathematics" className="bg-graphite">Mathematics</option>
                  </select>
                </div>

                {/* Sort Order Dropdown */}
                <div className="flex items-center gap-1 bg-blueprint-bg px-2.5 py-1 rounded border border-instrument-steel/15 text-[10px] font-mono text-instrument-steel">
                  <select
                    value={heatmapSortOrder}
                    onChange={(e) => {
                      setHeatmapSortOrder(e.target.value as any);
                      setSelectedHeatQuestionId(null);
                    }}
                    className="bg-transparent border-none text-chalk-white font-bold focus:outline-none cursor-pointer"
                  >
                    {heatmapViewMode === 'questions' && <option value="id" className="bg-graphite">Sort: Exam Order</option>}
                    <option value="accuracy-asc" className="bg-graphite">Sort: Weakest First</option>
                    <option value="accuracy-desc" className="bg-graphite">Sort: Strongest First</option>
                  </select>
                </div>
              </div>
            </div>

            {/* HEATMAP VIEWS */}
            {heatmapViewMode === 'questions' ? (
              <div className="space-y-4">
                {/* Question Heat Grid Legend */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[9px] font-mono text-instrument-steel">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-red-950/80 border border-red-500/40" />
                    <span>Critical Weakness (0% - 39% Acc)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-amber-950/80 border border-amber-500/40" />
                    <span>Vulnerable (40% - 69% Acc)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-yellow-950/40 border border-yellow-500/30" />
                    <span>Proficient (70% - 85% Acc)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-emerald-950/80 border border-emerald-500/40" />
                    <span>Mastered (86% - 100% Acc)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-blueprint-bg/40 border border-instrument-steel/15" />
                    <span>No Attempt History</span>
                  </div>
                </div>

                {heatmapData.questionHeat.length > 0 ? (
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 lg:grid-cols-15 gap-2 pt-1">
                    {heatmapData.questionHeat.map((qh) => {
                      let cellClass = '';
                      let statusText = '';

                      if (!qh.hasData) {
                        cellClass = 'bg-blueprint-bg/20 border-instrument-steel/15 text-instrument-steel hover:border-instrument-steel/30';
                        statusText = 'No attempt history';
                      } else if (qh.accuracy < 40) {
                        cellClass = 'bg-red-950/70 border-red-500/40 text-red-300 hover:bg-red-900/60';
                        statusText = `Critical: ${qh.accuracy}% accuracy (${qh.correctCount}/${qh.attemptedCount})`;
                      } else if (qh.accuracy < 70) {
                        cellClass = 'bg-amber-950/70 border-amber-500/40 text-amber-300 hover:bg-amber-900/60';
                        statusText = `Vulnerable: ${qh.accuracy}% accuracy (${qh.correctCount}/${qh.attemptedCount})`;
                      } else if (qh.accuracy < 86) {
                        cellClass = 'bg-yellow-950/40 border-yellow-500/30 text-yellow-300 hover:bg-yellow-900/40';
                        statusText = `Proficient: ${qh.accuracy}% accuracy (${qh.correctCount}/${qh.attemptedCount})`;
                      } else {
                        cellClass = 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60';
                        statusText = `Mastered: ${qh.accuracy}% accuracy (${qh.correctCount}/${qh.attemptedCount})`;
                      }

                      const isSelected = selectedHeatQuestionId === qh.id;

                      return (
                        <button
                          key={qh.id}
                          onClick={() => setSelectedHeatQuestionId(qh.id)}
                          className={`p-2.5 border rounded-lg text-center font-mono transition duration-150 flex flex-col items-center justify-center gap-0.5 cursor-pointer relative focus:outline-none ${cellClass} ${
                            isSelected ? 'ring-2 ring-circuit-amber/80 border-circuit-amber scale-105 shadow-md z-10' : ''
                          }`}
                          title={`Question ${qh.id} (${qh.subject}) - ${statusText}`}
                        >
                          <span className="text-[10px] font-bold block">Q{qh.id}</span>
                          <span className="text-[9px] font-black block opacity-90">
                            {qh.hasData ? `${qh.accuracy}%` : '-'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-instrument-steel text-xs font-mono italic">
                    No questions match the current subject filter.
                  </div>
                )}

                {/* DETAILED QUESTION INSPECTOR PANEL */}
                <div className="pt-2 border-t border-instrument-steel/10">
                  {selectedHeatQuestionId ? (() => {
                    const selectedQData = heatmapData.questionHeat.find(qh => qh.id === selectedHeatQuestionId);
                    if (!selectedQData) return null;
                    const qObj = selectedQData.q;

                    // Compute specific classes for the inspector accuracy banner
                    let inspectorAlertClass = 'bg-blueprint-bg border-instrument-steel/20';
                    let statusLabel = 'No History';
                    let descText = 'This question has not been attempted in any of your sessions yet.';

                    if (selectedQData.hasData) {
                      if (selectedQData.accuracy < 40) {
                        inspectorAlertClass = 'bg-red-950/20 border-red-900/30 text-red-300';
                        statusLabel = 'Critical weakness zone';
                        descText = 'Highest priority revision needed. Your accuracy is critically low on this concept. Review related formulas and theory.';
                      } else if (selectedQData.accuracy < 70) {
                        inspectorAlertClass = 'bg-amber-950/20 border-amber-900/30 text-amber-300';
                        statusLabel = 'Vulnerable concept area';
                        descText = 'Slight conceptual gaps detected. Focus on improving precision and eliminating silly calculation errors.';
                      } else if (selectedQData.accuracy < 86) {
                        inspectorAlertClass = 'bg-yellow-950/15 border-yellow-900/25 text-yellow-200';
                        statusLabel = 'Proficient performance';
                        descText = 'Good understanding. Work on reducing pacing overhead to maximize overall speed and score efficiency.';
                      } else {
                        inspectorAlertClass = 'bg-emerald-950/20 border-emerald-900/30 text-emerald-300';
                        statusLabel = 'Concept fully mastered';
                        descText = 'Outstanding accuracy! You have a bulletproof grasp of this topic. Ready to tackle advanced extensions.';
                      }
                    }

                    return (
                      <div className="bg-blueprint-bg/20 rounded-xl border border-instrument-steel/15 overflow-hidden animate-fade-in space-y-4 p-4">
                        {/* Inspector Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-instrument-steel/10 pb-3 gap-3">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <div className="px-3 py-1 bg-graphite rounded-lg border border-instrument-steel/30 font-mono text-xs font-black text-circuit-amber">
                              QUESTION {qObj.id} INSPECTOR
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 bg-graphite/40 border border-instrument-steel/10 rounded text-instrument-steel uppercase font-bold">
                              {qObj.subject}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 bg-graphite/40 border border-instrument-steel/10 rounded text-instrument-steel uppercase font-bold">
                              {qObj.difficulty || 'medium'} diff
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 bg-graphite/40 border border-instrument-steel/10 rounded text-instrument-steel uppercase font-bold">
                              {qObj.answerType.toUpperCase()}
                            </span>
                          </div>
                          
                          <button 
                            onClick={() => setSelectedHeatQuestionId(null)}
                            className="text-instrument-steel hover:text-chalk-white text-xs font-mono font-bold flex items-center gap-1 transition cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" /> CLOSE
                          </button>
                        </div>

                        {/* Concept Diagnostic Alert Banner */}
                        <div className={`p-3 border rounded-lg flex items-start gap-2.5 text-xs font-mono leading-relaxed ${inspectorAlertClass}`}>
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 animate-pulse" />
                          <div>
                            <span className="font-extrabold uppercase tracking-wide block text-[10px]">{statusLabel}</span>
                            <p className="mt-0.5 opacity-90 text-[11px]">{descText}</p>
                          </div>
                        </div>

                        {/* Interactive Grid columns */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                          {/* Left: LaTeX & Options (7 cols) */}
                          <div className="lg:col-span-7 space-y-4 bg-graphite/40 border border-instrument-steel/10 p-4 rounded-xl">
                            <span className="text-[9px] font-mono font-bold text-instrument-steel uppercase tracking-wider block">Question formulation:</span>
                            <div className="bg-graphite/60 border border-instrument-steel/15 rounded-lg p-4 overflow-x-auto min-h-16">
                              <LatexRenderer text={qObj.body} className="text-chalk-white select-text font-serif text-sm leading-relaxed" />
                            </div>

                            {/* Options Display */}
                            {qObj.answerType === 'mcq' && qObj.options && qObj.options.length > 0 && (
                              <div className="space-y-2 pt-2">
                                <span className="text-[9px] font-mono font-bold text-instrument-steel uppercase tracking-wider block">Multiple Choice Options:</span>
                                <div className="grid grid-cols-1 gap-2">
                                  {qObj.options.map((opt) => {
                                    const isCorrect = opt.id === qObj.correctOptionId;
                                    return (
                                      <div 
                                        key={opt.id} 
                                        className={`p-3 border rounded-lg flex items-center justify-between text-xs font-mono transition duration-150 ${
                                          isCorrect 
                                            ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400 font-bold' 
                                            : 'bg-blueprint-bg/25 border-instrument-steel/10 text-instrument-steel'
                                        }`}
                                      >
                                        <div className="flex items-start gap-2 max-w-[90%]">
                                          <span className="font-bold text-chalk-white">{opt.id.toUpperCase()}.</span>
                                          <LatexRenderer text={opt.text} className={isCorrect ? 'text-emerald-300' : 'text-instrument-steel'} />
                                        </div>
                                        {isCorrect && (
                                          <span className="text-[9px] bg-emerald-900/40 px-2 py-0.5 border border-emerald-500/30 rounded uppercase tracking-wide">
                                            Correct Key
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Correct Value for Numerical */}
                            {qObj.answerType === 'numerical' && (
                              <div className="pt-2">
                                <span className="text-[9px] font-mono font-bold text-instrument-steel uppercase tracking-wider block">Correct Numeric Answer:</span>
                                <div className="mt-1 p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-lg text-emerald-400 font-mono text-xs font-bold flex justify-between items-center">
                                  <span>Value: <strong className="text-chalk-white text-sm">{qObj.correctValue}</strong></span>
                                  <span className="text-[9px] bg-emerald-900/40 px-2 py-0.5 border border-emerald-500/30 rounded uppercase tracking-wide">
                                    Tolerance: ±{qObj.tolerance || 0}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Model Answer for Subjective */}
                            {qObj.answerType === 'subjective' && qObj.modelAnswer && (
                              <div className="pt-2">
                                <span className="text-[9px] font-mono font-bold text-instrument-steel uppercase tracking-wider block">Reference Model Answer:</span>
                                <div className="mt-1 p-3 bg-blueprint-bg/40 border border-instrument-steel/10 rounded-lg text-chalk-white font-mono text-xs">
                                  <LatexRenderer text={qObj.modelAnswer} />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Right: Detailed Pacing & Multi-session stats (5 cols) */}
                          <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
                            <div className="space-y-3 bg-graphite/40 border border-instrument-steel/10 p-4 rounded-xl flex-1">
                              <span className="text-[9px] font-mono font-bold text-instrument-steel uppercase tracking-wider block">Multi-Session performance logs:</span>
                              
                              <div className="grid grid-cols-2 gap-3 pt-1">
                                <div className="p-3 bg-blueprint-bg/40 border border-instrument-steel/10 rounded-lg text-center">
                                  <span className="text-[8px] font-mono text-instrument-steel uppercase block">Accuracy Quotient</span>
                                  <span className="text-xl font-mono font-black text-chalk-white block mt-1">
                                    {selectedQData.hasData ? `${selectedQData.accuracy}%` : 'N/A'}
                                  </span>
                                </div>

                                <div className="p-3 bg-blueprint-bg/40 border border-instrument-steel/10 rounded-lg text-center">
                                  <span className="text-[8px] font-mono text-instrument-steel uppercase block">Average Pacing</span>
                                  <span className="text-xl font-mono font-black text-chalk-white block mt-1">
                                    {selectedQData.hasData ? `${selectedQData.avgTime}s` : 'N/A'}
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-1.5 pt-2 text-[11px] font-mono leading-relaxed">
                                <div className="flex justify-between border-b border-instrument-steel/5 pb-1 gap-2">
                                  <span className="text-instrument-steel">Chapter/Topic:</span>
                                  <span className="font-semibold text-chalk-white text-right max-w-[65%] truncate" title={qObj.topic}>{qObj.topic}</span>
                                </div>
                                <div className="flex justify-between border-b border-instrument-steel/5 pb-1">
                                  <span className="text-instrument-steel">Attempted in Exams:</span>
                                  <span className="font-semibold text-chalk-white">{selectedQData.attemptedCount} / {testAttemptsCount} sessions</span>
                                </div>
                                <div className="flex justify-between border-b border-instrument-steel/5 pb-1">
                                  <span className="text-instrument-steel">Correct Evaluations:</span>
                                  <span className="font-semibold text-formula-green">{selectedQData.correctCount} correct</span>
                                </div>
                                <div className="flex justify-between border-b border-instrument-steel/5 pb-1">
                                  <span className="text-instrument-steel">Incorrect Evaluations:</span>
                                  <span className="font-semibold text-red-400">{selectedQData.incorrectCount} incorrect</span>
                                </div>
                                <div className="flex justify-between pb-1">
                                  <span className="text-instrument-steel">Pacing Efficiency:</span>
                                  <span className="font-semibold text-circuit-amber">
                                    {selectedQData.hasData 
                                      ? (selectedQData.avgTime > activeAttemptStats.avgTimePerQuestion * 1.5 ? '⚠️ Over pace limit' : '✓ Normal pace')
                                      : 'No pace data'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => onReviewAttempt(activeAttempt)}
                              className="w-full bg-circuit-amber hover:bg-circuit-amber/95 text-blueprint-bg py-2 rounded-lg font-mono text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <Eye className="w-4 h-4" /> Go to solutions for this test
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="bg-blueprint-bg/15 border border-dashed border-instrument-steel/20 rounded-xl py-12 px-6 text-center animate-fade-in">
                      <HelpCircle className="w-10 h-10 text-instrument-steel/40 mx-auto mb-3 animate-pulse" />
                      <p className="text-xs font-mono font-bold text-chalk-white uppercase">Interactive inspector ready</p>
                      <p className="text-[10px] font-mono text-instrument-steel mt-1 max-w-sm mx-auto leading-relaxed">
                        Select any question cell above to inspect the exact LaTeX question formulation, correct keys, answer options, and multi-session pacing stats.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Topic Heatmap view */
              <div className="space-y-4">
                {/* Topic view legend */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[9px] font-mono text-instrument-steel">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-red-950/80 border border-red-500/40" />
                    <span>Critical Revision (&lt; 50% Acc)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-amber-950/80 border border-amber-500/40" />
                    <span>Improvement Needed (50% - 74% Acc)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-emerald-950/80 border border-emerald-500/40" />
                    <span>Mastered (&gt;= 75% Acc)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-blueprint-bg/40 border border-instrument-steel/15" />
                    <span>No Attempt History</span>
                  </div>
                </div>

                {heatmapData.topicHeat.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-1">
                    {heatmapData.topicHeat.map((th) => {
                      let bgClass = '';
                      let badgeClass = '';
                      let badgeLabel = '';

                      if (!th.hasData) {
                        bgClass = 'bg-blueprint-bg/10 border-instrument-steel/10 text-instrument-steel';
                        badgeClass = 'bg-blueprint-bg/40 text-instrument-steel border border-instrument-steel/10';
                        badgeLabel = 'No History';
                      } else if (th.accuracy < 50) {
                        bgClass = 'bg-red-950/15 border-red-900/30 text-red-300';
                        badgeClass = 'bg-red-950/30 text-red-400 border border-red-900/30';
                        badgeLabel = 'Critical Revision';
                      } else if (th.accuracy < 75) {
                        bgClass = 'bg-amber-950/15 border-amber-900/30 text-amber-200';
                        badgeClass = 'bg-yellow-950/30 text-circuit-amber border border-yellow-900/30';
                        badgeLabel = 'Needs Improvement';
                      } else {
                        bgClass = 'bg-emerald-950/15 border-emerald-900/30 text-emerald-300';
                        badgeClass = 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/30';
                        badgeLabel = 'Mastered';
                      }

                      return (
                        <div 
                          key={th.topic} 
                          className={`border p-4 rounded-xl flex flex-col justify-between space-y-4 transition duration-150 hover:bg-graphite/40 ${bgClass}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <span className="text-[8px] font-mono text-instrument-steel uppercase tracking-wide block">{th.subject}</span>
                              <span className="text-xs font-bold text-chalk-white line-clamp-1 block" title={th.topic}>{th.topic}</span>
                            </div>
                            <span className={`text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded ${badgeClass}`}>
                              {badgeLabel}
                            </span>
                          </div>

                          {th.hasData ? (
                            <div className="space-y-1.5 font-mono text-[10px]">
                              {/* Accuracy Progress slider bar */}
                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-[9px]">
                                  <span className="text-instrument-steel uppercase">Concept Accuracy:</span>
                                  <span className="font-extrabold text-chalk-white">{th.accuracy}%</span>
                                </div>
                                <div className="w-full bg-graphite/60 border border-instrument-steel/10 rounded-full h-1.5 overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${
                                      th.accuracy < 50 ? 'bg-red-500' : th.accuracy < 75 ? 'bg-yellow-500' : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${th.accuracy}%` }}
                                  />
                                </div>
                              </div>

                              <div className="flex justify-between text-[9px] pt-1 border-t border-instrument-steel/5">
                                <span className="text-instrument-steel">Aggregated Attempts:</span>
                                <span className="font-extrabold text-chalk-white">{th.correctCount} OK vs {th.incorrectCount} ERR ({th.questionsCount}Q in syllabus)</span>
                              </div>
                              <div className="flex justify-between text-[9px]">
                                <span className="text-instrument-steel">Mean Pacing Rate:</span>
                                <span className="font-extrabold text-chalk-white">{th.avgTime}s / Question</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-4 text-instrument-steel text-[10px] font-mono italic bg-graphite/20 border border-instrument-steel/5 rounded-lg">
                              No questions attempted in this chapter yet.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-instrument-steel text-xs font-mono italic">
                    No topics match the current subject filter.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* IIT JEE NTA Student Response Matrix (Response Grid) */}
          <div className="bg-graphite rounded-xl border border-instrument-steel/20 shadow-sm p-5 space-y-4">
            <div className="border-b border-instrument-steel/10 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-mono font-bold text-chalk-white uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-circuit-amber" />
                  STUDENT RESPONSE MATRIX (EXAM GRID)
                </h3>
                <span className="text-[9px] font-mono text-instrument-steel">
                  Click on the "DEEP REVIEW EXAM PAPER" button to inspect individual solutions in full detail.
                </span>
              </div>
              
              <button
                onClick={() => onReviewAttempt(activeAttempt)}
                className="self-start sm:self-center bg-circuit-amber hover:bg-circuit-amber/95 text-blueprint-bg px-4 py-1.5 rounded font-mono text-[10px] font-extrabold tracking-wider transition cursor-pointer shadow flex items-center gap-1"
              >
                DEEP REVIEW EXAM PAPER
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Grid display legends */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[9px] font-mono text-instrument-steel">
              <div className="flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-extrabold text-center flex items-center justify-center">✓</span>
                <span>Correct</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded bg-red-950/60 border border-red-500/30 text-red-400 font-extrabold text-center flex items-center justify-center">✗</span>
                <span>Incorrect</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded bg-purple-950/60 border border-purple-500/30 text-purple-400 font-extrabold text-center flex items-center justify-center">?</span>
                <span>Marked for Review</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded bg-yellow-950/60 border border-yellow-500/30 text-circuit-amber font-extrabold text-center flex items-center justify-center">?</span>
                <span>Unassessed (Subjective)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded bg-blueprint-bg/60 border border-instrument-steel/20 text-instrument-steel font-extrabold text-center flex items-center justify-center">-</span>
                <span>Skipped / Unvisited</span>
              </div>
            </div>

            {/* Matrix Board */}
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 lg:grid-cols-15 gap-2.5 pt-2">
              {activeTest.questions.map((q, idx) => {
                const resp = activeAttempt.responses[q.id];
                const isAttempted = resp && resp.answer.trim() !== '';
                const isCorrect = resp && resp.isCorrect === true;
                const isIncorrect = resp && resp.isCorrect === false && isAttempted;
                const isMarked = resp && resp.isMarkedForReview;
                const isSubjective = q.answerType === 'subjective';
                const isUnassessed = isSubjective && isAttempted && resp.isCorrect === null;

                let cellBg = 'bg-blueprint-bg/40 border-instrument-steel/15 text-instrument-steel';
                let cellSymbol = '-';

                if (isMarked) {
                  cellBg = 'bg-purple-950/40 border-purple-500/30 text-purple-400';
                  cellSymbol = isCorrect ? '✓' : isIncorrect ? '✗' : '?';
                } else if (isAttempted) {
                  if (isCorrect) {
                    cellBg = 'bg-emerald-950/60 border-emerald-500/30 text-emerald-400';
                    cellSymbol = '✓';
                  } else if (isIncorrect) {
                    cellBg = 'bg-red-950/60 border-red-500/30 text-red-400';
                    cellSymbol = '✗';
                  } else if (isUnassessed) {
                    cellBg = 'bg-yellow-950/40 border-yellow-500/30 text-circuit-amber';
                    cellSymbol = '?';
                  }
                }

                return (
                  <div 
                    key={q.id} 
                    className={`p-2.5 border rounded-lg text-center font-mono text-xs flex flex-col items-center justify-center gap-0.5 select-none ${cellBg}`}
                    title={`Question ${idx + 1} (${q.subject} - ${q.topic})`}
                  >
                    <span className="text-[10px] font-extrabold text-chalk-white block">{idx + 1}</span>
                    <span className="text-[11px] font-black block">{cellSymbol}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* -------------------- MULTI-ATTEMPT COMPARISON VIEW -------------------- */}
      {activeTab === 'comparison' && (
        <div className="space-y-6">
          {/* Comparison selector instructions */}
          <div className="bg-graphite p-5 border border-instrument-steel/20 rounded-xl space-y-3 font-mono animate-fade-in">
            <h2 className="text-sm font-bold text-chalk-white flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-circuit-amber" />
              Side-by-Side Attempt Comparator Panel
            </h2>
            <p className="text-xs text-instrument-steel leading-relaxed">
              Toggle checkboxes on up to <span className="text-circuit-amber font-bold">3 attempts</span> in the Examination Attempt Logbook below to graph metrics Chronologically, inspect pacing side-by-side, and audit tab switches.
            </p>
            
            <div className="flex flex-wrap gap-2 pt-1">
              {attempts.map((att, idx) => {
                const isSelected = comparedAttemptIds.includes(att.id);
                const labelNum = attempts.length - idx;
                return (
                  <button
                    key={att.id}
                    onClick={() => toggleCompareAttempt(att.id)}
                    className={`px-3 py-1.5 rounded text-xs font-mono font-bold border transition duration-150 flex items-center gap-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-circuit-amber ${
                      isSelected
                        ? 'bg-blueprint-bg border-circuit-amber/50 text-circuit-amber'
                        : 'bg-blueprint-bg/20 border-instrument-steel/20 text-instrument-steel hover:text-chalk-white'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${
                      isSelected ? 'bg-circuit-amber' : 'bg-instrument-steel/40'
                    }`} />
                    Attempt #{labelNum} ({new Date(att.startTime).toLocaleDateString()})
                  </button>
                );
              })}
            </div>
          </div>

          {comparisonData.length > 0 ? (
            <>
              {/* Auto insights block */}
              {comparisonInsights && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-blueprint-bg/50 border border-instrument-steel/20 p-4 rounded-xl text-xs font-mono animate-fade-in">
                  <div className="space-y-1">
                    <span className="text-[10px] text-instrument-steel uppercase tracking-wide block font-bold">Top Scorer:</span>
                    <p className="font-extrabold text-circuit-amber">{comparisonInsights.highestScore.label}</p>
                    <p className="text-[10px] text-instrument-steel">Awarded {comparisonInsights.highestScore.val} total marks.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-instrument-steel uppercase tracking-wide block font-bold">Best Accuracy:</span>
                    <p className="font-extrabold text-circuit-amber">{comparisonInsights.bestAccuracy.label}</p>
                    <p className="text-[10px] text-instrument-steel">{comparisonInsights.bestAccuracy.val}% accuracy.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-instrument-steel uppercase tracking-wide block font-bold">Most Efficient:</span>
                    <p className="font-extrabold text-circuit-amber">{comparisonInsights.fastestPacing.label}</p>
                    <p className="text-[10px] text-instrument-steel">{comparisonInsights.fastestPacing.val}s average speed.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-instrument-steel uppercase tracking-wide block font-bold">Compliance Champion:</span>
                    <p className="font-extrabold text-circuit-amber">{comparisonInsights.mostSecure.label}</p>
                    <p className="text-[10px] text-instrument-steel">{comparisonInsights.mostSecure.val} screen exits detected.</p>
                  </div>
                </div>
              )}

              {/* Matrix Layout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                {comparisonData.map((cd, index) => {
                  if (!cd) return null;
                  return (
                    <div 
                      key={cd.id} 
                      className={`bg-graphite border rounded-xl p-6 space-y-6 relative overflow-hidden transition duration-150 ${
                        index === 0 ? 'border-circuit-amber/40 ring-1 ring-circuit-amber/10' : 'border-instrument-steel/20'
                      }`}
                    >
                      {/* Top banner tag */}
                      <div className="flex justify-between items-start border-b border-instrument-steel/10 pb-3">
                        <div>
                          <span className="text-xs font-mono font-bold text-circuit-amber uppercase tracking-widest">{cd.label}</span>
                          <h4 className="text-sm font-serif font-bold text-chalk-white mt-1 line-clamp-1">{cd.testName}</h4>
                          <p className="text-[10px] font-mono text-instrument-steel mt-1 flex items-center gap-1">
                            <User className="w-3 h-3" /> {cd.candidate} • {cd.date}
                          </p>
                        </div>
                      </div>

                      {/* Primary parameters side-by-side rows */}
                      <div className="space-y-3.5 font-mono text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-instrument-steel">Auto-Evaluated Score</span>
                          <span className="font-bold text-circuit-amber">{cd.score} marks</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-instrument-steel">Total Accuracy</span>
                          <span className="font-bold text-circuit-amber">{cd.overallAccuracy}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-instrument-steel">Answer Pacing (Avg)</span>
                          <span className="font-bold text-chalk-white">{cd.avgPacing}s / Q</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-instrument-steel">Attempt Quotient</span>
                          <span className="font-bold text-chalk-white">{cd.attemptRate}% ({cd.attempted}/{cd.totalQuestions})</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-instrument-steel flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-circuit-amber" /> Tab Exits</span>
                          <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                            cd.tabSwitches > 0 ? 'bg-yellow-950/40 text-circuit-amber border border-circuit-amber/20' : 'bg-blueprint-bg/50 text-formula-green border border-formula-green/20'
                          }`}>{cd.tabSwitches} switches</span>
                        </div>
                      </div>

                      {/* Subject breakdown stats card inside each column */}
                      <div className="bg-blueprint-bg/40 p-3 rounded border border-instrument-steel/20 space-y-2 font-mono">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-instrument-steel">Subject Accuracy Profiles:</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-1.5 bg-graphite border border-instrument-steel/10 rounded">
                            <span className="text-[9px] text-instrument-steel block">Physics</span>
                            <span className="text-xs font-bold text-circuit-amber">{cd.subjects.Physics}%</span>
                          </div>
                          <div className="p-1.5 bg-graphite border border-instrument-steel/10 rounded">
                            <span className="text-[9px] text-instrument-steel block">Chem</span>
                            <span className="text-xs font-bold text-circuit-amber">{cd.subjects.Chemistry}%</span>
                          </div>
                          <div className="p-1.5 bg-graphite border border-instrument-steel/10 rounded">
                            <span className="text-[9px] text-instrument-steel block">Maths</span>
                            <span className="text-xs font-bold text-circuit-amber">{cd.subjects.Mathematics}%</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>

              {/* Grouped Chart Visualizer */}
              {groupedComparisonChartData.length > 0 && (
                <div className="bg-graphite p-5 rounded-xl border border-instrument-steel/20 shadow-sm space-y-4 animate-fade-in">
                  <h3 className="text-xs font-mono font-bold text-chalk-white uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-circuit-amber" />
                    Comparative Subject Performance Chart (Accuracy %)
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={groupedComparisonChartData} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#7C8B99" opacity={0.15} />
                        <XAxis dataKey="subject" stroke="#7C8B99" fontSize={11} tickLine={false} fontFamily="IBM Plex Mono" />
                        <YAxis stroke="#7C8B99" fontSize={11} tickLine={false} domain={[0, 100]} fontFamily="IBM Plex Mono" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1B2733', borderColor: '#7C8B99', borderRadius: '4px', color: '#EDEFF2', fontSize: '11px', fontFamily: 'IBM Plex Mono' }}
                          formatter={(value: any) => [`${value}%`, 'Accuracy']}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', fontFamily: 'IBM Plex Mono' }} />
                        {comparisonData.map((cd, cIdx) => {
                          if (!cd) return null;
                          const colors = ['#F2A93B', '#3B82F6', '#10B981'];
                          return (
                            <Bar 
                              key={cd.id} 
                              dataKey={cd.label} 
                              fill={colors[cIdx % colors.length]} 
                              radius={[2, 2, 0, 0]} 
                              barSize={24} 
                            />
                          );
                        })}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-12 text-center bg-graphite border border-instrument-steel/20 rounded-xl text-instrument-steel text-xs font-mono">
              Select at least one attempt card to construct side-by-side performance comparison matrices.
            </div>
          )}
        </div>
      )}

      {/* Past History Logbook table with complete Action Controls */}
      <div className="bg-graphite rounded-xl border border-instrument-steel/20 shadow-sm overflow-hidden animate-fade-in">
        <div className="p-4 bg-blueprint-bg/50 border-b border-instrument-steel/20 flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
          <span className="text-xs font-mono font-bold text-chalk-white uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-circuit-amber" />
            Examination Attempt Logbook
          </span>
          <span className="text-[10px] text-instrument-steel font-mono font-bold uppercase tracking-wider">PERSISTED LOCALLY IN INDEXEDDB</span>
        </div>

        {/* Mobile View: Cards (Visible only on screens below sm breakpoint) */}
        <div className="block sm:hidden divide-y divide-instrument-steel/10">
          {attempts.map((att, idx) => {
            let totalScore = 0;
            Object.values(att.responses).forEach((r: any) => {
              if (r.earnedMarks !== null && r.earnedMarks !== undefined) {
                totalScore += r.earnedMarks;
              }
            });

            const isChecked = comparedAttemptIds.includes(att.id);

            return (
              <div key={att.id} className="p-4 space-y-3.5 hover:bg-blueprint-bg/10 transition duration-150">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {activeTab === 'comparison' && (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCompareAttempt(att.id)}
                        className="w-4 h-4 text-circuit-amber bg-blueprint-bg border-instrument-steel/30 rounded focus:ring-circuit-amber cursor-pointer"
                      />
                    )}
                    <span className="font-mono font-bold text-instrument-steel">Attempt #{attempts.length - idx}</span>
                  </div>
                  <span className="font-mono text-chalk-white text-xs">{att.candidateName}</span>
                </div>

                <div className="space-y-1">
                  <div className="font-serif font-bold text-chalk-white text-sm">{att.testName}</div>
                  <div className="font-mono text-[9px] text-instrument-steel">{new Date(att.startTime).toLocaleString()}</div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono text-[11px]">
                  <div>
                    <span className="text-instrument-steel">Score:</span>{' '}
                    <span className="font-bold text-circuit-amber">{totalScore}</span>{' '}
                    <span className="text-instrument-steel">marks</span>
                  </div>
                  <div>
                    {att.tabSwitchCount > 0 ? (
                      <span className="px-2 py-0.5 bg-yellow-950/40 text-circuit-amber border border-circuit-amber/20 rounded text-[9px] font-bold">
                        {att.tabSwitchCount} tab exits
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-blueprint-bg/50 text-formula-green border border-formula-green/20 rounded text-[9px] font-bold">
                        Compliant
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-instrument-steel/5">
                  <button
                    onClick={() => onReviewAttempt(att)}
                    className="flex-1 px-3 py-2 bg-circuit-amber hover:bg-circuit-amber/90 text-blueprint-bg text-xs font-mono font-bold rounded transition duration-150 cursor-pointer text-center"
                  >
                    INSPECT RESPONSES
                  </button>
                  <button
                    onClick={() => onDeleteAttempt(att.id)}
                    className="p-2 border border-instrument-steel/20 text-instrument-steel hover:text-red-400 hover:bg-red-950/20 hover:border-red-950 rounded transition duration-150 cursor-pointer"
                    title="Delete attempt record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tablet & Desktop View: Table (Hidden on mobile screens) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-blueprint-bg/20 text-instrument-steel font-mono font-bold border-b border-instrument-steel/10 text-[10px] uppercase">
                {activeTab === 'comparison' && <th className="p-3 w-12 text-center">Select</th>}
                <th className="p-3">Attempt</th>
                <th className="p-3">Candidate</th>
                <th className="p-3">Exam Name</th>
                <th className="p-3">Score</th>
                <th className="p-3">Compliance Exceptions</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-instrument-steel/10">
              {attempts.map((att, idx) => {
                let totalScore = 0;
                Object.values(att.responses).forEach((r: any) => {
                  if (r.earnedMarks !== null && r.earnedMarks !== undefined) {
                    totalScore += r.earnedMarks;
                  }
                });

                const isChecked = comparedAttemptIds.includes(att.id);

                return (
                  <tr key={att.id} className="hover:bg-blueprint-bg/20 transition duration-150">
                    {activeTab === 'comparison' && (
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCompareAttempt(att.id)}
                          className="w-4 h-4 text-circuit-amber bg-blueprint-bg border-instrument-steel/30 rounded focus:ring-circuit-amber cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="p-3 font-mono font-bold text-instrument-steel">#{attempts.length - idx}</td>
                    <td className="p-3 font-mono text-chalk-white">{att.candidateName}</td>
                    <td className="p-3">
                      <div className="font-serif font-bold text-chalk-white">{att.testName}</div>
                      <div className="font-mono text-[9px] text-instrument-steel mt-0.5">{new Date(att.startTime).toLocaleString()}</div>
                    </td>
                    <td className="p-3 font-mono">
                      <span className="font-bold text-circuit-amber">{totalScore}</span> <span className="text-instrument-steel">marks</span>
                    </td>
                    <td className="p-3 font-mono">
                      {att.tabSwitchCount > 0 ? (
                        <span className="px-2 py-0.5 bg-yellow-950/40 text-circuit-amber border border-circuit-amber/20 rounded text-[10px] font-bold">
                          {att.tabSwitchCount} tab exits
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-blueprint-bg/50 text-formula-green border border-formula-green/20 rounded text-[10px] font-bold">
                          Compliant
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => onReviewAttempt(att)}
                          className="px-3 py-1.5 bg-circuit-amber hover:bg-circuit-amber/90 text-blueprint-bg text-[10px] font-mono font-bold rounded transition duration-150 cursor-pointer focus:outline-none focus:ring-1 focus:ring-circuit-amber"
                        >
                          INSPECT RESPONSES
                        </button>
                        <button
                          onClick={() => onDeleteAttempt(att.id)}
                          className="p-1.5 border border-instrument-steel/20 text-instrument-steel hover:text-red-400 hover:bg-red-950/20 hover:border-red-950 rounded transition duration-150 cursor-pointer focus:outline-none focus:ring-1 focus:ring-red-500"
                          title="Delete attempt record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default AnalyticsDashboard;
