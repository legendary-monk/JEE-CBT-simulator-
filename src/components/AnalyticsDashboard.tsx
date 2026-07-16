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
        name: `Attempt #${chronological.length - index}`,
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
      <div className="max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-sm p-12 text-center space-y-6 my-12 animate-fade-in" id="analytics-empty">
        <div className="p-4 bg-blue-950/50 text-blue-400 border border-blue-900/30 rounded-full inline-block">
          <Trophy className="w-12 h-12" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-white">Your Practice Performance Arena</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            There are no saved exam sessions in your local database. Complete a CBT simulation paper to see your topic-wise weakness analysis, accuracy trend curves, and speed outliers.
          </p>
        </div>
        <button
          onClick={onLaunchPractice}
          className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow transition cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          Load & Launch Free Practice Mock
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 animate-fade-in" id="analytics-dashboard-root">
      
      {/* Selector & Navigation Tab Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            Accuracy & Calibration Dashboard
          </h1>
          <p className="text-xs text-slate-400">
            Real-time analytics engine fueled exclusively by your persistent client-side IndexedDB logs.
          </p>
        </div>

        {/* Tab triggers */}
        <div className="flex bg-slate-950/60 p-1 rounded-lg border border-slate-850">
          <button
            onClick={() => setActiveTab('individual')}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'individual'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            Single Attempt Analyzer
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'comparison'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            Side-by-Side Comparison ({comparedAttemptIds.length})
          </button>
        </div>
      </div>

      {/* -------------------- INDIVIDUAL ANALYSIS VIEW -------------------- */}
      {activeTab === 'individual' && activeAttemptStats && activeAttempt && (
        <>
          {/* Attempt Selector Dropdown inside Individual view */}
          <div className="flex flex-wrap items-center justify-between bg-slate-900/50 p-4 border border-slate-850 rounded-xl gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Analyze Attempt Profile:</span>
            </div>
            <select
              value={selectedAttemptId}
              onChange={(e) => setSelectedAttemptId(e.target.value)}
              className="text-sm px-3 py-1.5 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 outline-none focus:ring-1 focus:ring-blue-500 max-w-md"
            >
              {attempts.map((att, idx) => (
                <option key={att.id} value={att.id}>
                  Attempt #{attempts.length - idx} ({new Date(att.startTime).toLocaleDateString()}) — {att.testName}
                </option>
              ))}
            </select>
          </div>

          {/* Headline metric group: accuracy focused bento grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Primary Headline: Accuracy (Correct / Attempted) */}
            <div className="bg-gradient-to-br from-blue-700 to-indigo-700 text-white p-6 rounded-2xl shadow-sm relative overflow-hidden space-y-2 flex flex-col justify-between border border-blue-900/40">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block">
                  Overall Accuracy
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-4xl font-extrabold">{activeAttemptStats.overallAccuracy}%</span>
                  <span className="text-xs text-blue-200">correct</span>
                </div>
              </div>
              <p className="text-[10px] text-blue-100 leading-normal">
                Based on <span className="font-bold">{activeAttemptStats.correctCount}</span> correct evaluations out of <span className="font-bold">{activeAttemptStats.attemptedCount}</span> active question attempts.
              </p>
              <div className="absolute -right-6 -bottom-6 p-6 bg-white/5 rounded-full text-white/10 pointer-events-none">
                <Target className="w-24 h-24" />
              </div>
            </div>

            {/* Attempt Rate */}
            <div className="bg-slate-900 p-5 border border-slate-800 rounded-xl shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Attempt Rate
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-black text-white">{activeAttemptStats.attemptRate}%</span>
                  <span className="text-xs text-slate-400">answered</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                Answered <span className="font-semibold text-slate-200">{activeAttemptStats.attemptedCount}</span> questions. Left <span className="font-semibold text-slate-200">{activeAttemptStats.skippedCount}</span> blank.
              </p>
            </div>

            {/* Time Metrics */}
            <div className="bg-slate-900 p-5 border border-slate-800 rounded-xl shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Speed per Question
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-black text-white">{activeAttemptStats.avgTimePerQuestion}s</span>
                  <span className="text-xs text-slate-400">average</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                Spent a total of <span className="font-semibold text-slate-200">{Math.round(activeAttemptStats.timeSpentTotal / 60)} minutes</span> on {activeAttemptStats.totalQuestions} questions.
              </p>
            </div>

            {/* Negative Marking Impact */}
            <div className="bg-slate-900 p-5 border border-slate-800 rounded-xl shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Negative Penalty Loss
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-black text-red-400">-{activeAttemptStats.marksLostToNegative}</span>
                  <span className="text-xs text-slate-400">marks lost</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                Penalty deduction incurred due to <span className="font-semibold text-red-400">{activeAttemptStats.incorrectCount}</span> incorrect objective submissions.
              </p>
            </div>

          </div>

          {/* Visualizing Data Rows: Recharts Graphs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Subject accuracy breakdown */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm space-y-4">
              <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-blue-400" />
                Subject-Wise Accuracy Analysis
              </h3>
              
              {subjectChartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjectChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                      <XAxis dataKey="subject" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }}
                        formatter={(value: any) => [`${value}% Accuracy`, 'Accuracy']}
                      />
                      <Bar dataKey="accuracy" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-500 text-xs">No responses recorded</div>
              )}
            </div>

            {/* Historical accuracy trends curve */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm space-y-4">
              <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Attempt-Over-Attempt Accuracy Curve
              </h3>

              {historyChartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }}
                        formatter={(value: any) => [`${value}% Accuracy`, 'Accuracy']}
                      />
                      <Line type="monotone" dataKey="accuracy" stroke="#818cf8" strokeWidth={3} dot={{ r: 5, fill: '#818cf8' }} activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-500 text-xs">No attempt history yet</div>
              )}
            </div>

          </div>

          {/* Deep-dive stats group */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Answer-type accuracy table */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm space-y-4 lg:col-span-1">
              <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-400" />
                Response Type Accuracy
              </h3>

              <div className="divide-y divide-slate-800">
                {Object.entries(activeAttemptStats.typesStats).map(([type, data]: [string, any]) => {
                  const accuracy = data.attempted > 0 ? Math.round((data.correct / data.attempted) * 100) : 0;
                  return (
                    <div key={type} className="py-2.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 capitalize">{type}</span>
                      <div className="text-right">
                        <span className="text-sm font-black text-white">{accuracy}%</span>
                        <span className="text-[10px] text-slate-500 block">({data.correct}/{data.attempted} correct)</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Marked for Review conversion calibration */}
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Marked for Review Calibration:</span>
                  <span className="font-extrabold text-blue-400">{reviewConversionRate}%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1.5">
                  <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${reviewConversionRate}%` }} />
                </div>
                <p className="text-[9px] text-slate-500 leading-normal">
                  Out of <span className="font-bold">{activeAttemptStats.markedCount}</span> questions flagged for review, <span className="font-bold">{activeAttemptStats.markedCorrect}</span> ended up correct. High conversion rate indicates strong intuitive calibration.
                </p>
              </div>
            </div>

            {/* Time outliers & weak topics analysis */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm space-y-4 lg:col-span-2 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800 mb-2">
                  <AlertOctagon className="w-4 h-4 text-yellow-500" />
                  Time Outliers & Stuck Points
                </h3>

                {activeAttemptStats.outlierQuestions.length > 0 ? (
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {activeAttemptStats.outlierQuestions.map(out => (
                      <div key={out.id} className="flex items-center justify-between p-2 bg-yellow-950/20 border border-yellow-900/30 rounded-lg text-xs">
                        <div>
                          <span className="font-extrabold text-yellow-400">Q{out.id}</span>
                          <span className="text-[10px] text-slate-400 ml-2">({out.subject} • {out.topic})</span>
                        </div>
                        <span className="font-mono text-slate-300 font-semibold">{out.timeSpent} seconds spent</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No stuck-point outlier questions found. Excellent pacing!</p>
                )}
              </div>

              {/* Topic-wise weakest chapters */}
              <div className="pt-4 border-t border-slate-800">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-2">Weak Chapters Recommendation (Accuracy &lt; 50%):</h4>
                
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                  {Object.entries(activeAttemptStats.topicsStats)
                    .map(([name, data]: [string, any]) => {
                      const accuracy = data.attempted > 0 ? Math.round((data.correct / data.attempted) * 100) : 0;
                      return { name, accuracy, ...(data as any) };
                    })
                    .filter(t => t.accuracy < 50 && t.attempted > 0)
                    .map(t => (
                      <span key={t.name} className="px-2 py-1 bg-red-950/40 border border-red-900/30 text-red-400 text-[10px] font-bold rounded-md">
                        {t.name} ({t.accuracy}% acc)
                      </span>
                    ))}
                  {Object.entries(activeAttemptStats.topicsStats).filter(([name, data]: [string, any]) => data.attempted > 0).length === 0 && (
                    <span className="text-xs text-slate-500 italic">Complete a test to discover weak topic recommendations.</span>
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
          <div className="bg-slate-900 p-5 border border-slate-800 rounded-xl space-y-3">
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-blue-400" />
              Side-by-Side Attempt Comparator Panel
            </h2>
            <p className="text-xs text-slate-400 leading-normal">
              Toggle checkboxes on up to <span className="text-white font-bold">3 attempts</span> in the Examination Attempt Logbook below to graph metrics Chronologically, inspect pacing side-by-side, and auditing tab switches.
            </p>
            
            <div className="flex flex-wrap gap-2 pt-1">
              {attempts.map((att, idx) => {
                const isSelected = comparedAttemptIds.includes(att.id);
                const labelNum = attempts.length - idx;
                return (
                  <button
                    key={att.id}
                    onClick={() => toggleCompareAttempt(att.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-950 border-blue-500 text-blue-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${
                      isSelected ? 'bg-blue-400' : 'bg-slate-700'
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-blue-950/20 border border-blue-900/40 p-4 rounded-xl text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] text-blue-400 uppercase tracking-wide block font-black">Top Scorer:</span>
                    <p className="font-extrabold text-slate-200">{comparisonInsights.highestScore.label}</p>
                    <p className="text-[10px] text-slate-400">Awarded {comparisonInsights.highestScore.val} total marks.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-blue-400 uppercase tracking-wide block font-black">Best Accuracy:</span>
                    <p className="font-extrabold text-slate-200">{comparisonInsights.bestAccuracy.label}</p>
                    <p className="text-[10px] text-slate-400">{comparisonInsights.bestAccuracy.val}% accuracy on active responses.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-blue-400 uppercase tracking-wide block font-black">Most Efficient Pacing:</span>
                    <p className="font-extrabold text-slate-200">{comparisonInsights.fastestPacing.label}</p>
                    <p className="text-[10px] text-slate-400">{comparisonInsights.fastestPacing.val}s average answer speed.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-blue-400 uppercase tracking-wide block font-black">Compliance Champion:</span>
                    <p className="font-extrabold text-slate-200">{comparisonInsights.mostSecure.label}</p>
                    <p className="text-[10px] text-slate-400">{comparisonInsights.mostSecure.val} screen exits detected.</p>
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
                      className={`bg-slate-900 border rounded-2xl p-6 space-y-6 relative overflow-hidden transition ${
                        index === 0 ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-800'
                      }`}
                    >
                      {/* Top banner tag */}
                      <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                        <div>
                          <span className="text-xs font-black text-blue-400 uppercase tracking-widest">{cd.label}</span>
                          <h4 className="text-sm font-extrabold text-white mt-1 line-clamp-1">{cd.testName}</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <User className="w-3 h-3" /> {cd.candidate} • {cd.date}
                          </p>
                        </div>
                      </div>

                      {/* Primary parameters side-by-side rows */}
                      <div className="space-y-3.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400">Auto-Evaluated Score</span>
                          <span className="text-sm font-black text-emerald-400">{cd.score} marks</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400">Total Accuracy</span>
                          <span className="text-sm font-black text-blue-400">{cd.overallAccuracy}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400">Answer Pacing (Avg)</span>
                          <span className="text-sm font-black text-slate-200">{cd.avgPacing}s / Q</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400">Attempt Quotient</span>
                          <span className="text-sm font-black text-slate-200">{cd.attemptRate}% ({cd.attempted}/{cd.totalQuestions})</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400 flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-yellow-500" /> Tab Switch Alerts</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            cd.tabSwitches > 0 ? 'bg-yellow-950 text-yellow-400' : 'bg-green-950 text-green-400'
                          }`}>{cd.tabSwitches} switches</span>
                        </div>
                      </div>

                      {/* Subject breakdown stats card inside each column */}
                      <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-850 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Subject Accuracy Profiles:</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-1.5 bg-slate-900 border border-slate-800 rounded">
                            <span className="text-[9px] text-slate-500 block">Physics</span>
                            <span className="text-xs font-extrabold text-blue-400">{cd.subjects.Physics}%</span>
                          </div>
                          <div className="p-1.5 bg-slate-900 border border-slate-800 rounded">
                            <span className="text-[9px] text-slate-500 block">Chem</span>
                            <span className="text-xs font-extrabold text-teal-400">{cd.subjects.Chemistry}%</span>
                          </div>
                          <div className="p-1.5 bg-slate-900 border border-slate-800 rounded">
                            <span className="text-[9px] text-slate-500 block">Maths</span>
                            <span className="text-xs font-extrabold text-purple-400">{cd.subjects.Mathematics}%</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>

              {/* Grouped Chart Visualizer */}
              {groupedComparisonChartData.length > 0 && (
                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm space-y-4">
                  <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-400" />
                    Comparative Subject Performance Chart (Accuracy %)
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={groupedComparisonChartData} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                        <XAxis dataKey="subject" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0, 100]} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }}
                          formatter={(value: any) => [`${value}%`, 'Accuracy']}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        {comparisonData.map((cd, cIdx) => {
                          if (!cd) return null;
                          const colors = ['#3b82f6', '#818cf8', '#10b981'];
                          return (
                            <Bar 
                              key={cd.id} 
                              dataKey={cd.label} 
                              fill={colors[cIdx % colors.length]} 
                              radius={[4, 4, 0, 0]} 
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
            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-500 text-xs">
              Select at least one attempt card to construct side-by-side performance comparison matrices.
            </div>
          )}
        </div>
      )}

      {/* Past History Logbook table with complete Action Controls */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-blue-400" />
            Examination Attempt Logbook
          </span>
          <span className="text-[10px] text-slate-500 font-bold">PERSISTED LOCALLY IN INDEXEDDB</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/30 text-slate-400 font-bold border-b border-slate-800 text-[10px] uppercase">
                {activeTab === 'comparison' && <th className="p-3 w-12 text-center">Select</th>}
                <th className="p-3">Attempt ID</th>
                <th className="p-3">Candidate</th>
                <th className="p-3">Exam Name</th>
                <th className="p-3">Score</th>
                <th className="p-3">Compliance Exceptions</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {attempts.map((att, idx) => {
                let totalScore = 0;
                Object.values(att.responses).forEach((r: any) => {
                  totalScore += r.earnedMarks || 0;
                });

                const isChecked = comparedAttemptIds.includes(att.id);

                return (
                  <tr key={att.id} className="hover:bg-slate-950/30 transition">
                    {activeTab === 'comparison' && (
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCompareAttempt(att.id)}
                          className="w-4 h-4 text-blue-600 bg-slate-950 border-slate-800 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="p-3 font-semibold text-slate-500">#{attempts.length - idx}</td>
                    <td className="p-3 font-bold text-slate-200">{att.candidateName}</td>
                    <td className="p-3 text-slate-300">
                      <div>{att.testName}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{new Date(att.startTime).toLocaleString()}</div>
                    </td>
                    <td className="p-3 text-slate-200">
                      <span className="font-extrabold text-blue-400">{totalScore}</span> marks
                    </td>
                    <td className="p-3">
                      {att.tabSwitchCount > 0 ? (
                        <span className="px-2 py-0.5 bg-yellow-950/50 text-yellow-400 border border-yellow-900/30 rounded text-[10px] font-bold">
                          {att.tabSwitchCount} tab switch exceptions
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-green-950/50 text-green-400 border border-green-900/30 rounded text-[10px] font-bold">
                          No switches (Compliant)
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => onReviewAttempt(att)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg transition cursor-pointer"
                        >
                          Inspect Responses
                        </button>
                        <button
                          onClick={() => onDeleteAttempt(att.id)}
                          className="p-1.5 border border-slate-800 text-red-400 hover:bg-red-950/30 hover:border-red-900/40 rounded-lg transition cursor-pointer"
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
