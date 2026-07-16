/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Attempt, Test } from '../types';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis
} from 'recharts';
import { 
  Trophy, 
  TrendingUp, 
  Clock, 
  Target, 
  BookOpen, 
  Percent, 
  AlertOctagon, 
  RotateCcw,
  Gauge, 
  ArrowRight,
  Sparkles,
  Zap,
  Flame,
  Calendar,
  Layers,
  Trash2
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
  const [selectedAttemptId, setSelectedAttemptId] = useState<string>(
    attempts.length > 0 ? attempts[0].id : ''
  );

  // Active analyzed attempt
  const activeAttempt = useMemo(() => {
    return attempts.find(a => a.id === selectedAttemptId) || attempts[0] || null;
  }, [attempts, selectedAttemptId]);

  // Find matching test for questions structure
  const activeTest = useMemo(() => {
    if (!activeAttempt) return null;
    return tests.find(t => t.id === activeAttempt.testId) || null;
  }, [activeAttempt, tests]);

  // Calculations for current active attempt
  const activeAttemptStats = useMemo(() => {
    if (!activeAttempt || !activeTest) return null;

    let totalQuestions = activeTest.questions.length;
    let attemptedCount = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;
    let marksLostToNegative = 0;

    let timeSpentTotal = 0;
    let questionTimes: Record<string, number> = {};
    
    // Subject stats
    const subjectsStats: Record<string, { total: number; attempted: number; correct: number }> = {};
    // Topic stats
    const topicsStats: Record<string, { total: number; attempted: number; correct: number; subject: string }> = {};
    // Answer type stats (MCQ, Numerical, Subjective)
    const typesStats: Record<string, { total: number; attempted: number; correct: number }> = {
      mcq: { total: 0, attempted: 0, correct: 0 },
      numerical: { total: 0, attempted: 0, correct: 0 },
      subjective: { total: 0, attempted: 0, correct: 0 },
    };

    // Review conversion calibration
    let markedCount = 0;
    let markedCorrect = 0;

    activeTest.questions.forEach(q => {
      const resp = activeAttempt.responses[q.id];
      if (!resp) return;

      const isAttempted = resp.answer.trim() !== '';
      const isCorrect = resp.isCorrect === true;
      const isIncorrect = resp.isCorrect === false && isAttempted;
      timeSpentTotal += resp.timeSpentSeconds;
      questionTimes[q.id] = resp.timeSpentSeconds;

      // Subject init/add
      if (!subjectsStats[q.subject]) {
        subjectsStats[q.subject] = { total: 0, attempted: 0, correct: 0 };
      }
      subjectsStats[q.subject].total++;

      // Topic init/add
      if (!topicsStats[q.topic]) {
        topicsStats[q.topic] = { total: 0, attempted: 0, correct: 0, subject: q.subject };
      }
      topicsStats[q.topic].total++;

      // Answer Type add
      typesStats[q.answerType].total++;

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
          // Track negative marks lost
          if (resp.earnedMarks !== null && resp.earnedMarks < 0) {
            marksLostToNegative += Math.abs(resp.earnedMarks);
          }
        }
      } else {
        skippedCount++;
      }

      // Calibration: marked-for-review conversion
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

    // Identify outliers (questions taking > 1.5x average time)
    const outlierQuestions = activeTest.questions.filter(q => {
      const t = activeAttempt.responses[q.id]?.timeSpentSeconds || 0;
      return t > avgTimePerQuestion * 1.5 && t > 20; // must be above average and at least 20s
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

  // Rolling historic trends across ALL attempts (chronological order)
  const historyChartData = useMemo(() => {
    // Reverse attempts so we plot from oldest to newest
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
        name: `Attempt ${chronological.length - index}`,
        date: new Date(att.startTime).toLocaleDateString(),
        accuracy,
        score,
        testName: att.testName
      };
    });
  }, [attempts]);

  // Subject-wise accuracy chart data
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

  // Speed vs Accuracy scatter data: Time taken vs correctness
  const speedAccuracyData = useMemo(() => {
    if (!activeAttempt || !activeTest) return [];
    return activeTest.questions.map(q => {
      const resp: any = activeAttempt.responses[q.id];
      if (!resp || resp.answer.trim() === '') return null;
      return {
        id: q.id,
        time: resp.timeSpentSeconds,
        correct: resp.isCorrect ? 100 : 0, // binary but easy to plot
        label: `${q.id} (${q.subject})`,
        status: resp.isCorrect ? 'Correct' : 'Incorrect'
      };
    }).filter(Boolean);
  }, [activeAttempt, activeTest]);

  // Calibration statistics for Marked for Review conversions
  const reviewConversionRate = useMemo(() => {
    if (!activeAttemptStats || activeAttemptStats.markedCount === 0) return 0;
    return Math.round((activeAttemptStats.markedCorrect / activeAttemptStats.markedCount) * 100);
  }, [activeAttemptStats]);

  if (attempts.length === 0) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-sm p-12 text-center space-y-6 my-12 animate-fade-in" id="analytics-empty">
        <div className="p-4 bg-blue-50 text-blue-600 rounded-full inline-block">
          <Trophy className="w-12 h-12" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-gray-900">Your Practice Performance Arena</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
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
      
      {/* Selector & headline bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Accuracy & Calibration Dashboard
          </h1>
          <p className="text-xs text-gray-500">
            Real-time analytics engine fueled exclusively by your persistent client-side IndexedDB logs.
          </p>
        </div>

        {/* Attempt history selector drop-down */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Analyze Attempt:</label>
          <select
            value={selectedAttemptId}
            onChange={(e) => setSelectedAttemptId(e.target.value)}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg bg-white outline-none focus:ring-1 focus:ring-blue-500"
          >
            {attempts.map((att, idx) => (
              <option key={att.id} value={att.id}>
                Attempt {attempts.length - idx} ({new Date(att.startTime).toLocaleDateString()}) — {att.testName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeAttemptStats && activeAttempt && (
        <>
          {/* Headline metric group: accuracy focused bento grid (Section 6) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Primary Headline: Accuracy (Correct / Attempted) */}
            <div className="bg-gradient-to-br from-blue-700 to-indigo-700 text-white p-6 rounded-2xl shadow-sm relative overflow-hidden space-y-2 flex flex-col justify-between">
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
            <div className="bg-white p-5 border border-gray-200 rounded-xl shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                  Attempt Rate
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-black text-gray-800">{activeAttemptStats.attemptRate}%</span>
                  <span className="text-xs text-gray-500">answered</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 leading-normal">
                Answered <span className="font-semibold text-gray-700">{activeAttemptStats.attemptedCount}</span> questions. Left <span className="font-semibold text-gray-700">{activeAttemptStats.skippedCount}</span> blank.
              </p>
            </div>

            {/* Time Metrics */}
            <div className="bg-white p-5 border border-gray-200 rounded-xl shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                  Speed per Question
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-black text-gray-800">{activeAttemptStats.avgTimePerQuestion}s</span>
                  <span className="text-xs text-gray-500">average</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 leading-normal">
                Spent a total of <span className="font-semibold text-gray-700">{Math.round(activeAttemptStats.timeSpentTotal / 60)} minutes</span> on {activeAttemptStats.totalQuestions} questions.
              </p>
            </div>

            {/* Negative Marking Impact */}
            <div className="bg-white p-5 border border-gray-200 rounded-xl shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                  Negative Penalty Loss
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-black text-red-500">-{activeAttemptStats.marksLostToNegative}</span>
                  <span className="text-xs text-gray-400">marks lost</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 leading-normal">
                Penalty deduction incurred due to <span className="font-semibold text-red-500">{activeAttemptStats.incorrectCount}</span> incorrect objective submissions.
              </p>
            </div>

          </div>

          {/* Visualizing Data Rows: Recharts Graphs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Subject accuracy breakdown (Section 6) */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-blue-500" />
                Subject-Wise Accuracy Analysis
              </h3>
              
              {subjectChartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjectChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="subject" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                        formatter={(value: any) => [`${value}% Accuracy`, 'Accuracy']}
                      />
                      <Bar dataKey="accuracy" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400 text-xs">No responses recorded</div>
              )}
            </div>

            {/* Historical accuracy trends curve (Section 6) */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                Attempt-Over-Attempt Accuracy Curve
              </h3>

              {historyChartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                        formatter={(value: any) => [`${value}% Accuracy`, 'Accuracy']}
                      />
                      <Line type="monotone" dataKey="accuracy" stroke="#4f46e5" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400 text-xs">No attempt history yet</div>
              )}
            </div>

          </div>

          {/* Deep-dive stats group */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Answer-type accuracy table (Section 6) */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4 lg:col-span-1">
              <h3 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-500" />
                Response Type Accuracy
              </h3>

              <div className="divide-y divide-gray-100">
                {Object.entries(activeAttemptStats.typesStats).map(([type, data]: [string, any]) => {
                  const accuracy = data.attempted > 0 ? Math.round((data.correct / data.attempted) * 100) : 0;
                  return (
                    <div key={type} className="py-2.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-600 capitalize">{type}</span>
                      <div className="text-right">
                        <span className="text-sm font-black text-gray-800">{accuracy}%</span>
                        <span className="text-[10px] text-gray-400 block">({data.correct}/{data.attempted} correct)</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Marked for Review conversion calibration */}
              <div className="pt-4 border-t border-gray-100 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">Marked for Review Calibration:</span>
                  <span className="font-extrabold text-blue-600">{reviewConversionRate}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${reviewConversionRate}%` }} />
                </div>
                <p className="text-[9px] text-gray-400 leading-normal">
                  Out of <span className="font-bold">{activeAttemptStats.markedCount}</span> questions flagged for review, <span className="font-bold">{activeAttemptStats.markedCorrect}</span> ended up correct. High conversion rate indicates strong intuitive calibration.
                </p>
              </div>
            </div>

            {/* Time outliers & weak topics analysis */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4 lg:col-span-2 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-gray-100 mb-2">
                  <AlertOctagon className="w-4 h-4 text-yellow-500" />
                  Time Outliers & Stuck Points
                </h3>

                {activeAttemptStats.outlierQuestions.length > 0 ? (
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {activeAttemptStats.outlierQuestions.map(out => (
                      <div key={out.id} className="flex items-center justify-between p-2 bg-yellow-50/50 border border-yellow-100 rounded-lg text-xs">
                        <div>
                          <span className="font-extrabold text-yellow-800">Q{out.id}</span>
                          <span className="text-[10px] text-gray-500 ml-2">({out.subject} • {out.topic})</span>
                        </div>
                        <span className="font-mono text-gray-600 font-semibold">{out.timeSpent} seconds spent</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No stuck-point outlier questions found. Excellent pacing!</p>
                )}
              </div>

              {/* Topic-wise weakest chapters */}
              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider text-[10px] mb-2">Weak Chapters Recommendation (Accuracy &lt; 50%):</h4>
                
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                  {Object.entries(activeAttemptStats.topicsStats)
                    .map(([name, data]: [string, any]) => {
                      const accuracy = data.attempted > 0 ? Math.round((data.correct / data.attempted) * 100) : 0;
                      return { name, accuracy, ...(data as any) };
                    })
                    .filter(t => t.accuracy < 50 && t.attempted > 0)
                    .map(t => (
                      <span key={t.name} className="px-2 py-1 bg-red-50 border border-red-100 text-red-700 text-[10px] font-bold rounded-md">
                        {t.name} ({t.accuracy}% acc)
                      </span>
                    ))}
                  {Object.entries(activeAttemptStats.topicsStats).filter(([name, data]: [string, any]) => data.attempted > 0).length === 0 && (
                    <span className="text-xs text-gray-400 italic">Complete a test to discover weak topic recommendations.</span>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Past History Table with action controls */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs font-extrabold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-500" />
                Examination Attempt Logbook
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/50 text-gray-600 font-bold border-b border-gray-200 text-[10px] uppercase">
                    <th className="p-3">Attempt ID</th>
                    <th className="p-3">Candidate</th>
                    <th className="p-3">Exam Name</th>
                    <th className="p-3">Score</th>
                    <th className="p-3">Compliance Exceptions</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {attempts.map((att, idx) => {
                    let totalScore = 0;
                    Object.values(att.responses).forEach((r: any) => {
                      totalScore += r.earnedMarks || 0;
                    });

                    return (
                      <tr key={att.id} className="hover:bg-slate-50/50 transition">
                        <td className="p-3 font-semibold text-gray-400">#{attempts.length - idx}</td>
                        <td className="p-3 font-bold text-gray-700">{att.candidateName}</td>
                        <td className="p-3 text-gray-600">
                          <div>{att.testName}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{new Date(att.startTime).toLocaleString()}</div>
                        </td>
                        <td className="p-3 text-gray-800">
                          <span className="font-extrabold text-blue-600">{totalScore}</span> marks
                        </td>
                        <td className="p-3">
                          {att.tabSwitchCount > 0 ? (
                            <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded text-[10px] font-bold">
                              {att.tabSwitchCount} tab switch exceptions
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-[10px] font-bold">
                              No switches (Compliant)
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => onReviewAttempt(att)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg transition"
                            >
                              Inspect Responses
                            </button>
                            <button
                              onClick={() => onDeleteAttempt(att.id)}
                              className="p-1.5 border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 rounded-lg transition"
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
        </>
      )}

    </div>
  );
};
export default AnalyticsDashboard;
