/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Attempt, Question, QuestionResponse } from '../types';
import { LatexRenderer } from './LatexRenderer';
import { saveAttempt } from '../db';
import { 
  Check, 
  X, 
  Info, 
  AlertCircle, 
  CheckCircle, 
  BookOpen, 
  Award, 
  ThumbsUp, 
  HelpCircle,
  Eye,
  Settings
} from 'lucide-react';

interface AttemptReviewProps {
  attempt: Attempt;
  testQuestions: Question[];
  onReviewUpdated: (updatedAttempt: Attempt) => void;
  onClose: () => void;
}

export const AttemptReview: React.FC<AttemptReviewProps> = ({
  attempt,
  testQuestions,
  onReviewUpdated,
  onClose,
}) => {
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>(
    testQuestions.length > 0 ? testQuestions[0].id : ''
  );
  
  // Settings toggle: "Include subjective marks in the main score summary"
  const [includeSubjective, setIncludeSubjective] = useState(false);

  // Current selected question object
  const currentQuestion = testQuestions.find(q => q.id === selectedQuestionId);
  const currentResponse = attempt.responses[selectedQuestionId];

  // Manual self-grading of subjective answer
  const handleGradeSubjective = (assessment: 'correct' | 'partial' | 'incorrect') => {
    if (!selectedQuestionId || !currentQuestion) return;

    let earnedMarks = 0;
    let isCorrect = false;

    if (assessment === 'correct') {
      earnedMarks = attempt.markingScheme.subjectivePositive;
      isCorrect = true;
    } else if (assessment === 'partial') {
      earnedMarks = Math.round(attempt.markingScheme.subjectivePositive / 2); // 50% partial marks
      isCorrect = true; // counted as correct/partially correct in rate
    } else if (assessment === 'incorrect') {
      earnedMarks = attempt.markingScheme.subjectiveNegative;
      isCorrect = false;
    }

    const updatedResponses = {
      ...attempt.responses,
      [selectedQuestionId]: {
        ...attempt.responses[selectedQuestionId],
        selfAssessment: assessment,
        isCorrect,
        earnedMarks
      }
    };

    const updatedAttempt: Attempt = {
      ...attempt,
      responses: updatedResponses
    };

    // Save back to DB and propagate state upward
    saveAttempt(updatedAttempt)
      .then(() => onReviewUpdated(updatedAttempt))
      .catch(err => console.error("Failed to save graded subjective answer", err));
  };

  // Calculations for review summary
  const stats = React.useMemo(() => {
    let objectiveEarned = 0;
    let objectiveTotal = 0;
    let objectiveCorrect = 0;
    let objectiveIncorrect = 0;
    let objectiveAttempted = 0;

    let subjectiveEarned = 0;
    let subjectiveCorrect = 0;
    let subjectiveIncorrect = 0;
    let subjectiveAttempted = 0;

    testQuestions.forEach(q => {
      const resp = attempt.responses[q.id];
      if (!resp) return;

      const maxQuestionMarks = q.marks !== null ? q.marks : (
        q.answerType === 'mcq' ? attempt.markingScheme.mcqPositive : attempt.markingScheme.numericalPositive
      );

      if (q.answerType === 'subjective') {
        if (resp.answer.trim() !== '') {
          subjectiveAttempted++;
        }
        if (resp.selfAssessment === 'correct') {
          subjectiveCorrect++;
          subjectiveEarned += attempt.markingScheme.subjectivePositive;
        } else if (resp.selfAssessment === 'partial') {
          subjectiveCorrect++;
          subjectiveEarned += Math.round(attempt.markingScheme.subjectivePositive / 2);
        } else if (resp.selfAssessment === 'incorrect') {
          subjectiveIncorrect++;
          subjectiveEarned += attempt.markingScheme.subjectiveNegative;
        }
      } else {
        // MCQ or Numerical
        objectiveTotal += maxQuestionMarks;
        if (resp.answer.trim() !== '') {
          objectiveAttempted++;
        }
        if (resp.isCorrect === true) {
          objectiveCorrect++;
          objectiveEarned += resp.earnedMarks || 0;
        } else if (resp.isCorrect === false && resp.answer.trim() !== '') {
          objectiveIncorrect++;
          objectiveEarned += resp.earnedMarks || 0;
        }
      }
    });

    const totalEarned = includeSubjective ? (objectiveEarned + subjectiveEarned) : objectiveEarned;
    const totalAttempted = objectiveAttempted + subjectiveAttempted;
    const accuracy = totalAttempted > 0 
      ? Math.round(((objectiveCorrect + (includeSubjective ? subjectiveCorrect : 0)) / totalAttempted) * 100) 
      : 0;

    return {
      objectiveEarned,
      objectiveTotal,
      objectiveCorrect,
      objectiveIncorrect,
      objectiveAttempted,
      subjectiveEarned,
      subjectiveCorrect,
      subjectiveIncorrect,
      subjectiveAttempted,
      totalEarned,
      totalAttempted,
      accuracy
    };
  }, [attempt, testQuestions, includeSubjective]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-fade-in" id="attempt-review-root">
      
      {/* Header section */}
      <div className="flex flex-wrap justify-between items-center bg-white p-5 rounded-xl border border-gray-200 shadow-sm gap-4">
        <div>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wide">
            CBT Exam Response Sheet Review
          </span>
          <h1 className="text-xl font-black text-gray-900 mt-1">
            Review: {attempt.testName}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Candidate: <span className="font-bold text-gray-700">{attempt.candidateName}</span> • Submitted on {new Date(attempt.endTime || 0).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-lg transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Overview Stats Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Score */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-xl shadow-sm space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Auto-Graded Score
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold">{stats.objectiveEarned}</span>
            <span className="text-xs text-slate-400">/ {stats.objectiveTotal} marks</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-normal">
            Objective-only score. Excludes self-assessed subjective responses by default to prevent grade leakage.
          </p>
        </div>

        {/* Self-Assessed Score */}
        <div className="bg-white p-5 border border-gray-200 rounded-xl shadow-sm space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
            Subjective Self-Graded
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-purple-600">+{stats.subjectiveEarned}</span>
            <span className="text-xs text-gray-400">marks</span>
          </div>
          <p className="text-[10px] text-gray-500 leading-normal">
            Graded manually by comparing solutions with model answers. ({stats.subjectiveCorrect} Correct / Partial)
          </p>
        </div>

        {/* Combined Accuracy */}
        <div className="bg-white p-5 border border-gray-200 rounded-xl shadow-sm space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
            Test Accuracy Rate
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-blue-600">{stats.accuracy}%</span>
          </div>
          <p className="text-[10px] text-gray-500 leading-normal">
            Calculated as ({stats.objectiveCorrect + (includeSubjective ? stats.subjectiveCorrect : 0)} ÷ {stats.totalAttempted || 1}) total correct.
          </p>
        </div>

        {/* Switch settings / toggles */}
        <div className="bg-white p-5 border border-gray-200 rounded-xl shadow-sm flex flex-col justify-center space-y-3">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-bold text-gray-700">Display Adjustments</span>
          </div>
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeSubjective}
              onChange={(e) => setIncludeSubjective(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <span className="text-[11px] text-gray-600 leading-normal">
              Blend manual subjective scores into overall summary metrics.
            </span>
          </label>
        </div>
      </div>

      {/* Main Review Section (Split Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" style={{ minHeight: '500px' }}>
        
        {/* Left column: navigation palette (1/4 width) */}
        <div className="lg:col-span-1 bg-slate-50 border-r border-gray-200 p-4 space-y-4">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider pb-1.5 border-b border-gray-200">
            Questions Index
          </h3>
          
          <div className="grid grid-cols-5 gap-1.5 max-h-[450px] overflow-y-auto pr-1">
            {testQuestions.map((q, qIdx) => {
              const resp = attempt.responses[q.id];
              let style = 'bg-gray-100 text-gray-400 hover:bg-gray-200'; // skipped
              
              if (resp) {
                if (q.answerType === 'subjective') {
                  if (resp.selfAssessment === 'correct') {
                    style = 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200';
                  } else if (resp.selfAssessment === 'partial') {
                    style = 'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200';
                  } else if (resp.selfAssessment === 'incorrect') {
                    style = 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200';
                  } else if (resp.answer.trim() !== '') {
                    style = 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200'; // needs grading
                  }
                } else {
                  if (resp.answer.trim() === '') {
                    style = 'bg-gray-100 text-gray-400 hover:bg-gray-200';
                  } else if (resp.isCorrect === true) {
                    style = 'bg-green-500 text-white hover:bg-green-600';
                  } else {
                    style = 'bg-red-500 text-white hover:bg-red-600';
                  }
                }
              }

              const isCurrent = q.id === selectedQuestionId;

              return (
                <button
                  key={q.id}
                  onClick={() => setSelectedQuestionId(q.id)}
                  className={`relative aspect-square text-xs font-bold rounded flex items-center justify-center border transition select-none ${style} ${
                    isCurrent ? 'ring-2 ring-blue-600 border-white scale-105 z-10' : 'border-transparent'
                  }`}
                  title={`${q.subject} • ${q.answerType}`}
                >
                  {qIdx + 1}
                  {q.answerType === 'subjective' && !resp?.selfAssessment && resp?.answer.trim() !== '' && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-purple-500 rounded-full border border-white" title="Needs self-grading" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-[10px] text-gray-500 space-y-1">
            <p className="font-bold text-gray-700">Index Color Keys:</p>
            <div className="grid grid-cols-2 gap-1 mt-1 text-[9px]">
              <div className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full" /><span>Objective Correct</span></div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full" /><span>Objective Wrong</span></div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 bg-purple-400 rounded-full" /><span>Subj Needs self-grading</span></div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 bg-gray-200 rounded-full" /><span>Blank / Skipped</span></div>
            </div>
          </div>
        </div>

        {/* Right column: active question details & grading arena (3/4 width) */}
        <div className="lg:col-span-3 p-6 flex flex-col space-y-6 overflow-y-auto" style={{ maxHeight: '550px' }}>
          {currentQuestion && currentResponse ? (
            <div className="space-y-6">
              {/* Context bar */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="space-y-1">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold rounded">
                    Question {currentQuestion.id} • {currentQuestion.subject}
                  </span>
                  <p className="text-xs text-gray-400">
                    Topic: <span className="font-semibold text-gray-600">{currentQuestion.topic}</span> • Difficulty: <span className="font-semibold text-gray-600 capitalize">{currentQuestion.difficulty || 'medium'}</span>
                  </p>
                </div>

                <div className="text-right text-xs">
                  <p className="text-gray-400">Time spent on question:</p>
                  <p className="font-bold text-gray-700">{currentResponse.timeSpentSeconds} seconds</p>
                </div>
              </div>

              {/* Question Statement */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Question Statement:</h4>
                <div className="p-4 bg-slate-50 border border-gray-100 rounded-lg">
                  <LatexRenderer text={currentQuestion.body} />
                </div>
              </div>

              {/* MCQ Response Review */}
              {currentQuestion.answerType === 'mcq' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Options & Selections:</h4>
                  <div className="space-y-2.5">
                    {currentQuestion.options.map((opt, oIdx) => {
                      const isSelected = currentResponse.answer === opt;
                      const isCorrectAnswer = currentQuestion.correctOption === opt;
                      
                      let cardStyle = 'border-gray-200';
                      let icon = null;

                      if (isSelected) {
                        if (isCorrectAnswer) {
                          cardStyle = 'border-green-300 bg-green-50/40 text-green-900';
                          icon = <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />;
                        } else {
                          cardStyle = 'border-red-300 bg-red-50/40 text-red-900';
                          icon = <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />;
                        }
                      } else if (isCorrectAnswer) {
                        cardStyle = 'border-green-200 bg-green-50/20 text-green-800';
                        icon = <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />;
                      }

                      return (
                        <div key={oIdx} className={`p-3 border rounded-lg flex items-start gap-3 text-sm transition ${cardStyle}`}>
                          <span className="font-bold text-gray-400 mt-0.5">{String.fromCharCode(65 + oIdx)}.</span>
                          <div className="flex-1">
                            <LatexRenderer text={opt} />
                          </div>
                          {icon}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Numerical Response Review */}
              {currentQuestion.answerType === 'numerical' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Numerical Analysis:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* User answer */}
                    <div className="p-4 border border-gray-200 rounded-lg bg-slate-50/50 space-y-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase block">Your Answer:</span>
                      {currentResponse.answer.trim() === '' ? (
                        <span className="text-sm italic text-gray-400">Question Skipped / Blank</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-mono font-bold text-gray-800">{currentResponse.answer}</span>
                          {currentResponse.isCorrect ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">Correct</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded">Incorrect</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Correct answer key */}
                    <div className="p-4 border border-gray-200 rounded-lg bg-slate-50/50 space-y-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase block">Correct Answer Key:</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-mono font-black text-green-600">{currentQuestion.correctValue}</span>
                        {currentQuestion.tolerance !== null && currentQuestion.tolerance > 0 && (
                          <span className="text-xs text-gray-500">(Tolerance: ±{currentQuestion.tolerance})</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Subjective Solution & Self-Assessment Grading panel */}
              {currentQuestion.answerType === 'subjective' && (
                <div className="space-y-4">
                  
                  {/* Student text */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Submitted Solution:</h4>
                    <div className="p-4 border border-gray-200 rounded-lg bg-slate-50/45 min-h-12 text-sm whitespace-pre-wrap leading-relaxed">
                      {currentResponse.answer.trim() === '' ? (
                        <span className="italic text-gray-400 text-xs">No response typed during exam.</span>
                      ) : (
                        currentResponse.answer
                      )}
                    </div>
                  </div>

                  {/* Model answer key */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-purple-600 uppercase tracking-wider">Official Model Answer (LaTeX Rendered):</h4>
                    <div className="p-4 border border-purple-100 rounded-lg bg-purple-50/30">
                      {currentQuestion.modelAnswer ? (
                        <LatexRenderer text={currentQuestion.modelAnswer} />
                      ) : (
                        <span className="text-xs text-gray-400">No model answer provided in source file.</span>
                      )}
                    </div>
                  </div>

                  {/* Self assessment grading (5.4) */}
                  {currentResponse.answer.trim() !== '' && (
                    <div className="p-4 border border-yellow-200 bg-yellow-50/45 rounded-xl space-y-3">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-yellow-600" />
                        <span className="text-xs font-bold text-gray-800">Self-Assessment Scoring Deck:</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-normal">
                        Subjective answers cannot be auto-evaluated. Compare your submitted formulas and text against the official model key above, and choose the correct grade:
                      </p>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          onClick={() => handleGradeSubjective('correct')}
                          className={`px-4 py-2 text-xs font-bold rounded-lg border transition shadow-sm flex items-center gap-1 cursor-pointer ${
                            currentResponse.selfAssessment === 'correct'
                              ? 'bg-green-600 border-green-600 text-white'
                              : 'bg-white border-green-200 text-green-700 hover:bg-green-50'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          Mark Correct (+{attempt.markingScheme.subjectivePositive})
                        </button>
                        <button
                          onClick={() => handleGradeSubjective('partial')}
                          className={`px-4 py-2 text-xs font-bold rounded-lg border transition shadow-sm flex items-center gap-1 cursor-pointer ${
                            currentResponse.selfAssessment === 'partial'
                              ? 'bg-yellow-500 border-yellow-500 text-white'
                              : 'bg-white border-yellow-200 text-yellow-700 hover:bg-yellow-50'
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          Mark Partial Correct (+{Math.round(attempt.markingScheme.subjectivePositive / 2)})
                        </button>
                        <button
                          onClick={() => handleGradeSubjective('incorrect')}
                          className={`px-4 py-2 text-xs font-bold rounded-lg border transition shadow-sm flex items-center gap-1 cursor-pointer ${
                            currentResponse.selfAssessment === 'incorrect'
                              ? 'bg-red-600 border-red-600 text-white'
                              : 'bg-white border-red-200 text-red-700 hover:bg-red-50'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                          Mark Incorrect ({attempt.markingScheme.subjectiveNegative})
                        </button>
                      </div>

                      {currentResponse.selfAssessment && (
                        <p className="text-[10px] font-bold text-green-600 flex items-center gap-1 mt-2">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Response self-graded successfully! Current Awarded: {currentResponse.earnedMarks} marks.</span>
                        </p>
                      )}
                    </div>
                  )}

                </div>
              )}

            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              Select a question from the palette index to review detailed correct keys and scoring parameters.
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
export default AttemptReview;
