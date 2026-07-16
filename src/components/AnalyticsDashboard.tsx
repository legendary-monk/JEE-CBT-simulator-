/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Attempt, Test } from '../types';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
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
  TrendingDown
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

  // Active analyzed individual attempt
  const activeAttempt = useMemo(() => {
    return attempts.find(a => a.id === selectedAttemptId) || attempts[0] || null;
  }, [attempts, selectedAttemptId]);

  // Find matching test for questions structure
  const activeTest = useMemo(() => {
    if (!activeAttempt) return null;
    return tests.find(t => t.id === activeAttempt.testId) || null;
  }, [activeAttempt, tests]);

  // Individual attempt calculations
  const activeAttemptStats = useMemo(() => {
    if (!activeAttempt || !activeTest) return null;

    let totalQuestions = activeTest.questions.length;
    let attemptedCount = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;
    let marksLostToNegative = 0;
    let timeSpentTotal = 0;
    
    // Subject stats
    const subjectsStats: Record<string, { total: number; attempted: number; correct: number; totalTime: number }> = {};
    // Topic stats
    const topicsStats: Record<string, { total: number; attempted: number; correct: number; subject: string }> = {};
    // Answer type stats
    const typesStats: Record<string, { total: number; attempted: number; correct: number }> = {
      mcq: { total: 0, attempted: 0, correct: 0 },
      numerical: { total: 0, attempted: 0, correct: 0 },
      subjective: { total: 0, attempted: 0, correct: 0 },
    };

    let markedCount = 0;
    let markedCorrect = 0;

    activeTest.questions.forEach(q => {
      const resp = activeAttempt.responses[q.id];
      if (!resp) return;

      const isAttempted = resp.answer.trim() !== '';
      const isCorrect = resp.isCorrect === true;
      const isIncorrect = resp.isCorrect === false && isAttempted;
      timeSpentTotal += resp.timeSpentSeconds;

      // Subject aggregate
      if (!subjectsStats[q.subject]) {
        subjectsStats[q.subject] = { total: 0, attempted: 0, correct: 0, totalTime: 0 };
      }
      subjectsStats[q.subject].total++;
      subjectsStats[q.subject].totalTime += resp.timeSpentSeconds;

      // Topic aggregate
      if (!topicsStats[q.topic]) {
        topicsStats[q.topic] = { total: 0, attempted: 0, correct: 0, subject: q.subject };
      }
      topicsStats[q.topic].total++;

      // Type aggregate
      if (typesStats[q.answerType]) {
        typesStats[q.answerType].total++;
      }

      if (isAttempted) {
        attemptedCount++;
        subjectsStats[q.subject].attempted++;
        topicsStats[q.topic].attempted++;
        typesStats[q.answerType].attempted++;

        if (isCorrect) {
          correctCount++;
          subjectsStats[q.subject].correct++;
          topicsStats[q.topic].correct++;
          typesStats[q.answerType].correct++;
        } else if (isIncorrect) {
          incorrectCount++;
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

    const overallAccuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
    const attemptRate = totalQuestions > 0 ? Math.round((attemptedCount / totalQuestions) * 100) : 0;
    const avgTimePerQuestion = totalQuestions > 0 ? Math.round(timeSpentTotal / totalQuestions) : 0;

    // Outlier questions (> 1.5x average)
    const outlierQuestions = activeTest.questions.filter(q => {
      const t = activeAttempt.responses[q.id]?.timeSpentSeconds || 0;
      return t > avgTimePerQuestion * 1.5 && t > 20;
    }).map(q => ({
      id: q.id,
      subject: q.subject,
      topic: q.topic,
      timeSpent: activeAttempt.responses[q.id]?.timeSpentSeconds || 0
    }));

    return {
      totalQuestions,
      attemptedCount,
      correctCount,
      incorrectCount,
      skippedCount,
      marksLostToNegative,
      overallAccuracy,
      attemptRate,
      avgTimePerQuestion,
      outlierQuestions,
      subjectsStats,
      topicsStats,
      typesStats,
      markedCount,
      markedCorrect,
      timeSpentTotal
    };
  }, [activeAttempt, activeTest]);

  // Chronological metrics trends for Sparkline / Line charts
  const historyChartData = useMemo(() => {
    const chronological = [...attempts].reverse();
    return chronological.map((att, index) => {
      let correct = 0;
      let attempted = 0;
      let score = 0;

      Object.values(att.responses).forEach((resp: any) => {
        if (resp.answer.trim() !== '') {
          attempted++;
          if (resp.isCorrect === true) {
            correct++;
          }
        }
        score += resp.earnedMarks || 0;
      });

      const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
      return {
        name: `Att #${chronological.length - index}`,
        date: new Date(att.startTime).toLocaleDateString(),
        accuracy,
        score,
        testName: att.testName
      };
    });
  }, [attempts]);

  // Subject accuracy chart data
  const subjectChartData = useMemo(() => {
    if (!activeAttemptStats) return [];
    return Object.entries(activeAttemptStats.subjectsStats).map(([sub, data]: [string, any]) => {
      const accuracy = data.attempted > 0 ? Math.round((data.correct / data.attempted) * 100) : 0;
      return {
        subject: sub,
        accuracy,
        attempted: data.attempted,
        correct: data.correct,
        total: data.total
      };
    });
  }, [activeAttemptStats]);

  // Subject pacing chart data
  const subjectPacingChartData = useMemo(() => {
    if (!activeAttemptStats) return [];
    return Object.entries(activeAttemptStats.subjectsStats).map(([sub, data]: [string, any]) => {
      const avgTime = data.total > 0 ? Math.round(data.totalTime / data.total) : 0;
      return {
        subject: sub,
        avgTime,
        totalTime: data.totalTime
      };
    });
  }, [activeAttemptStats]);

  // Subject response state distribution chart data
  const subjectDistributionChartData = useMemo(() => {
    if (!activeAttemptStats) return [];
    return Object.entries(activeAttemptStats.subjectsStats).map(([sub, data]: [string, any]) => {
      let answered = 0;
      let notAnswered = 0;
      let marked = 0;
      let answeredMarked = 0;
      let notVisited = 0;

      if (activeTest) {
        activeTest.questions.forEach(q => {
          if (q.subject !== sub) return;
          const resp = activeAttempt?.responses[q.id];
          if (!resp) return;
          if (resp.state === 'NOT_VISITED') notVisited++;
          else if (resp.state === 'NOT_ANSWERED') notAnswered++;
          else if (resp.state === 'ANSWERED') answered++;
          else if (resp.state === 'MARKED_FOR_REVIEW') marked++;
          else if (resp.state === 'ANSWERED_AND_MARKED_FOR_REVIEW') answeredMarked++;
        });
      }

      return {
        subject: sub,
        Answered: answered,
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
        // Keep at least 1 selected if possible
        if (prev.length === 1) return prev;
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 3) {
        // Rotate out first choice
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
      let incorrect = 0;
      let timeSpent = 0;
      let physicsCorrect = 0, physicsAttempted = 0;
      let chemistryCorrect = 0, chemistryAttempted = 0;
      let mathsCorrect = 0, mathsAttempted = 0;

      Object.values(att.responses).forEach((resp: any) => {
        timeSpent += resp.timeSpentSeconds;
        const isAttempted = resp.answer.trim() !== '';
        if (isAttempted) {
          attempted++;
          if (resp.isCorrect === true) {
            correct++;
          } else {
            incorrect++;
          }
        }
        score += resp.earnedMarks || 0;
      });

      // Split subject metrics
      if (t) {
        t.questions.forEach(q => {
          const resp = att.responses[q.id];
          if (resp && resp.answer.trim() !== '') {
            if (q.subject === 'Physics') {
              physicsAttempted++;
              if (resp.isCorrect === true) physicsCorrect++;
            } else if (q.subject === 'Chemistry') {
              chemistryAttempted++;
              if (resp.isCorrect === true) chemistryCorrect++;
            } else if (q.subject === 'Mathematics') {
              mathsAttempted++;
              if (resp.isCorrect === true) mathsCorrect++;
            }
          }
        });
      }

      const overallAccuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
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
          Physics: physicsAttempted > 0 ? Math.round((physicsCorrect / physicsAttempted) * 100) : 0,
          Chemistry: chemistryAttempted > 0 ? Math.round((chemistryCorrect / chemistryAttempted) * 100) : 0,
          Mathematics: mathsAttempted > 0 ? Math.round((mathsCorrect / mathsAttempted) * 100) : 0,
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
          LAUNCH CBT arena
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pb-12 animate-fade-in" id="analytics-dashboard-root">
      
      {/* Selector & Navigation Tab Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-graphite p-5 rounded-xl border border-instrument-steel/20 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-serif font-bold text-chalk-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-circuit-amber" />
            Accuracy & Calibration Dashboard
          </h1>
          <p className="text-xs text-instrument-steel">
            Real-time analytics engine fueled exclusively by your persistent client-side IndexedDB logs.
          </p>
        </div>

        {/* Tab triggers */}
        <div className="flex bg-blueprint-bg p-1 rounded-lg border border-instrument-steel/20 font-mono w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('individual')}
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 text-[9px] sm:text-[10px] font-bold rounded transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-circuit-amber ${
              activeTab === 'individual'
                ? 'bg-graphite text-circuit-amber border border-instrument-steel/30 shadow-sm'
                : 'text-instrument-steel hover:text-chalk-white border border-transparent'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            SINGLE ATTEMPT
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 text-[9px] sm:text-[10px] font-bold rounded transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-circuit-amber ${
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
              className="w-full sm:w-auto text-xs font-mono px-3 py-1.5 border border-instrument-steel/30 rounded bg-blueprint-bg text-chalk-white outline-none focus:border-circuit-amber transition duration-150 max-w-full sm:max-w-md cursor-pointer"
            >
              {attempts.map((att, idx) => (
                <option key={att.id} value={att.id}>
                  Attempt #{attempts.length - idx} ({new Date(att.startTime).toLocaleDateString()}) — {att.testName}
                </option>
              ))}
            </select>
          </div>

          {/* Headline metric group: accuracy focused bento grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Primary Headline: Accuracy Instrument Dial */}
            <div className="bg-graphite border border-instrument-steel/30 rounded-xl p-6 shadow-sm flex flex-col items-center justify-center space-y-4 col-span-1 sm:col-span-2 lg:col-span-1 min-h-[220px]">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-instrument-steel block self-start">
                ACCURACY CALIBRATION
              </span>
              
              {/* SVG Analog Dial */}
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-95" viewBox="0 0 100 100">
                  {/* Background Dial Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#0D1B2A" /* Blueprint bg */
                    strokeWidth="8"
                  />
                  {/* Active Sweep Indicator */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={activeAttemptStats.overallAccuracy >= 70 ? "#4C9A6A" : "#F2A93B"} /* Formula Green or Circuit Amber */
                    strokeWidth="8"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * activeAttemptStats.overallAccuracy) / 100}
                    strokeLinecap="round"
                    className="animate-sweep"
                    style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.1, 0.8, 0.2, 1)' }}
                  />
                </svg>
                
                {/* Dial Text / Value HUD */}
                <div className="absolute inset-0 flex flex-col items-center justify-center select-none mt-1">
                  <span className="text-3xl font-mono font-extrabold text-chalk-white leading-none">
                    {activeAttemptStats.overallAccuracy}
                    <span className="text-xs text-instrument-steel font-normal ml-0.5">%</span>
                  </span>
                  <span className="text-[8px] font-mono text-instrument-steel uppercase tracking-widest mt-1">
                    CALIBRATED
                  </span>
                </div>
              </div>

              <div className="text-center font-mono text-[10px] text-instrument-steel leading-normal">
                {activeAttemptStats.correctCount} OK / {activeAttemptStats.attemptedCount} ACT
              </div>
            </div>

            {/* Attempt Rate */}
            <div className="bg-graphite p-5 border border-instrument-steel/20 rounded-xl shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-instrument-steel block">
                  Attempt Rate
                </span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-mono font-bold text-circuit-amber">{activeAttemptStats.attemptRate}%</span>
                  <span className="text-xs text-instrument-steel font-mono">answered</span>
                </div>
              </div>
              <p className="text-[10px] text-instrument-steel leading-relaxed font-mono">
                Answered <span className="font-semibold text-chalk-white">{activeAttemptStats.attemptedCount}</span> questions. Left <span className="font-semibold text-chalk-white">{activeAttemptStats.skippedCount}</span> blank.
              </p>
            </div>

            {/* Time Metrics */}
            <div className="bg-graphite p-5 border border-instrument-steel/20 rounded-xl shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-instrument-steel block">
                  Speed per Question
                </span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-mono font-bold text-circuit-amber">{activeAttemptStats.avgTimePerQuestion}s</span>
                  <span className="text-xs text-instrument-steel font-mono">average</span>
                </div>
              </div>
              <p className="text-[10px] text-instrument-steel leading-relaxed font-mono">
                Spent a total of <span className="font-semibold text-chalk-white">{Math.round(activeAttemptStats.timeSpentTotal / 60)} minutes</span> on {activeAttemptStats.totalQuestions} questions.
              </p>
            </div>

            {/* Negative Marking Impact */}
            <div className="bg-graphite p-5 border border-instrument-steel/20 rounded-xl shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-instrument-steel block">
                  Negative Penalty Loss
                </span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-mono font-bold text-circuit-amber">-{activeAttemptStats.marksLostToNegative}</span>
                  <span className="text-xs text-instrument-steel font-mono">marks lost</span>
                </div>
              </div>
              <p className="text-[10px] text-instrument-steel leading-relaxed font-mono">
                Penalty deduction incurred due to <span className="font-semibold text-circuit-amber">{activeAttemptStats.incorrectCount}</span> incorrect objective submissions.
              </p>
            </div>

          </div>

          {/* Visualizing Data Rows: Recharts Graphs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Subject accuracy breakdown */}
            <div className="bg-graphite p-5 rounded-xl border border-instrument-steel/20 shadow-sm space-y-4">
              <h3 className="text-xs font-mono font-bold text-chalk-white uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-circuit-amber" />
                Subject-Wise Accuracy Analysis
              </h3>
              
              {subjectChartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjectChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#7C8B99" opacity={0.15} />
                      <XAxis dataKey="subject" stroke="#7C8B99" fontSize={11} tickLine={false} fontFamily="IBM Plex Mono" />
                      <YAxis stroke="#7C8B99" fontSize={11} tickLine={false} domain={[0, 100]} fontFamily="IBM Plex Mono" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1B2733', borderColor: '#7C8B99', borderRadius: '4px', color: '#EDEFF2', fontSize: '11px', fontFamily: 'IBM Plex Mono' }}
                        formatter={(value: any) => [`${value}% Accuracy`, 'Accuracy']}
                      />
                      <Bar dataKey="accuracy" fill="#F2A93B" radius={[2, 2, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-instrument-steel text-xs font-mono">No responses recorded</div>
              )}
            </div>

            {/* Historical accuracy trends curve */}
            <div className="bg-graphite p-5 rounded-xl border border-instrument-steel/20 shadow-sm space-y-4">
              <h3 className="text-xs font-mono font-bold text-chalk-white uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-circuit-amber" />
                Attempt-Over-Attempt Accuracy Curve
              </h3>

              {historyChartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#7C8B99" opacity={0.15} />
                      <XAxis dataKey="name" stroke="#7C8B99" fontSize={11} tickLine={false} fontFamily="IBM Plex Mono" />
                      <YAxis stroke="#7C8B99" fontSize={11} tickLine={false} domain={[0, 100]} fontFamily="IBM Plex Mono" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1B2733', borderColor: '#7C8B99', borderRadius: '4px', color: '#EDEFF2', fontSize: '11px', fontFamily: 'IBM Plex Mono' }}
                        formatter={(value: any) => [`${value}% Accuracy`, 'Accuracy']}
                      />
                      <Line type="monotone" dataKey="accuracy" stroke="#F2A93B" strokeWidth={2} dot={{ r: 4, fill: '#F2A93B' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-instrument-steel text-xs font-mono">No attempt history yet</div>
              )}
            </div>

          </div>

          {/* Visualizing Data Rows: Additional Visual Post-Exam Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Subject response distribution stacked bar chart */}
            <div className="bg-graphite p-5 rounded-xl border border-instrument-steel/20 shadow-sm space-y-4">
              <h3 className="text-xs font-mono font-bold text-chalk-white uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-circuit-amber" />
                Subject-Wise Response State Distribution
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
                      <Bar dataKey="Ans & Marked" stackId="a" fill="#EDEFF2" />
                      <Bar dataKey="Not Visited" stackId="a" fill="#0D1B2A" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-instrument-steel text-xs font-mono">No metrics recorded</div>
              )}
            </div>

            {/* Subject pacing speed bar chart */}
            <div className="bg-graphite p-5 rounded-xl border border-instrument-steel/20 shadow-sm space-y-4">
              <h3 className="text-xs font-mono font-bold text-chalk-white uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-circuit-amber" />
                Subject-Wise Average Pacing (Seconds / Question)
              </h3>

              {subjectPacingChartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjectPacingChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#7C8B99" opacity={0.15} />
                      <XAxis dataKey="subject" stroke="#7C8B99" fontSize={11} tickLine={false} fontFamily="IBM Plex Mono" />
                      <YAxis stroke="#7C8B99" fontSize={11} tickLine={false} fontFamily="IBM Plex Mono" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1B2733', borderColor: '#7C8B99', borderRadius: '4px', color: '#EDEFF2', fontSize: '11px', fontFamily: 'IBM Plex Mono' }}
                        formatter={(value: any) => [`${value}s / Question`, 'Pacing']}
                      />
                      <Bar dataKey="avgTime" fill="#7C8B99" radius={[2, 2, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-instrument-steel text-xs font-mono">No attempt history yet</div>
              )}
            </div>

          </div>

          {/* Deep-dive stats group */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Answer-type accuracy table */}
            <div className="bg-graphite p-5 rounded-xl border border-instrument-steel/20 shadow-sm space-y-4 lg:col-span-1">
              <h3 className="text-xs font-mono font-bold text-chalk-white uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-circuit-amber" />
                Response Type Accuracy
              </h3>

              <div className="divide-y divide-instrument-steel/10">
                {Object.entries(activeAttemptStats.typesStats).map(([type, data]: [string, any]) => {
                  const accuracy = data.attempted > 0 ? Math.round((data.correct / data.attempted) * 100) : 0;
                  return (
                    <div key={type} className="py-2.5 flex items-center justify-between font-mono text-xs">
                      <span className="font-bold text-instrument-steel capitalize">{type}</span>
                      <div className="text-right">
                        <span className="font-extrabold text-circuit-amber">{accuracy}%</span>
                        <span className="text-[10px] text-instrument-steel block">({data.correct}/{data.attempted})</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Marked for Review conversion calibration */}
              <div className="pt-4 border-t border-instrument-steel/10 space-y-2">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="font-bold text-instrument-steel uppercase tracking-wider">Review Calibration:</span>
                  <span className="font-bold text-circuit-amber">{reviewConversionRate}%</span>
                </div>
                <div className="w-full bg-blueprint-bg rounded-full h-1.5">
                  <div className="bg-circuit-amber h-1.5 rounded-full" style={{ width: `${reviewConversionRate}%` }} />
                </div>
                <p className="text-[9px] font-mono text-instrument-steel leading-relaxed">
                  Out of {activeAttemptStats.markedCount} flagged, {activeAttemptStats.markedCorrect} evaluated correct. High calibration shows high intuitive conversion.
                </p>
              </div>
            </div>

            {/* Time outliers & weak topics analysis */}
            <div className="bg-graphite p-5 rounded-xl border border-instrument-steel/20 shadow-sm space-y-4 lg:col-span-2 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-mono font-bold text-chalk-white uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-instrument-steel/10 mb-2">
                  <AlertOctagon className="w-4 h-4 text-circuit-amber" />
                  Time Outliers & Stuck Points
                </h3>

                {activeAttemptStats.outlierQuestions.length > 0 ? (
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {activeAttemptStats.outlierQuestions.map(out => (
                      <div key={out.id} className="flex items-center justify-between p-2 bg-blueprint-bg/40 border border-instrument-steel/20 rounded text-xs font-mono">
                        <div>
                          <span className="font-bold text-circuit-amber">Q{out.id}</span>
                          <span className="text-[10px] text-instrument-steel ml-2">({out.subject} • {out.topic})</span>
                        </div>
                        <span className="text-instrument-steel">{out.timeSpent}s spent</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-instrument-steel font-mono italic">No stuck-point outlier questions found. Excellent pacing!</p>
                )}
              </div>

              {/* Topic-wise weakest chapters */}
              <div className="pt-4 border-t border-instrument-steel/10">
                <h4 className="text-[10px] font-mono font-bold text-instrument-steel uppercase tracking-wider mb-2">Weak Chapters (Accuracy &lt; 50%):</h4>
                
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                  {Object.entries(activeAttemptStats.topicsStats)
                    .map(([name, data]: [string, any]) => {
                      const accuracy = data.attempted > 0 ? Math.round((data.correct / data.attempted) * 100) : 0;
                      return { name, accuracy, ...(data as any) };
                    })
                    .filter(t => t.accuracy < 50 && t.attempted > 0)
                    .map(t => (
                      <span key={t.name} className="px-2 py-1 bg-blueprint-bg/60 border border-instrument-steel/20 text-circuit-amber text-[10px] font-mono rounded">
                        {t.name} ({t.accuracy}% acc)
                      </span>
                    ))}
                  {Object.entries(activeAttemptStats.topicsStats).filter(([name, data]: [string, any]) => data.attempted > 0).length === 0 && (
                    <span className="text-xs text-instrument-steel font-mono italic">No recommendations yet. Complete more tests.</span>
                  )}
                </div>
              </div>
            </div>

          </div>
        </>
      )}

      {/* -------------------- MULTI-ATTEMPT COMPARISON VIEW -------------------- */}
      {activeTab === 'comparison' && (
        <div className="space-y-6">
          {/* Comparison selector instructions */}
          <div className="bg-graphite p-5 border border-instrument-steel/20 rounded-xl space-y-3 font-mono">
            <h2 className="text-sm font-bold text-chalk-white flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-circuit-amber" />
              Side-by-Side Attempt Comparator Panel
            </h2>
            <p className="text-xs text-instrument-steel leading-relaxed">
              Toggle checkboxes on up to <span className="text-circuit-amber font-bold">3 attempts</span> in the Examination Attempt Logbook below to graph metrics Chronologically, inspect pacing side-by-side, and auditing tab switches.
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-blueprint-bg/50 border border-instrument-steel/20 p-4 rounded-xl text-xs font-mono">
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <div className="bg-graphite p-5 rounded-xl border border-instrument-steel/20 shadow-sm space-y-4">
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
                          const colors = ['#F2A93B', '#EDEFF2', '#7C8B99'];
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
              totalScore += r.earnedMarks || 0;
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
                  totalScore += r.earnedMarks || 0;
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
