/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Question, Attempt, QuestionResponse, MarkingScheme, Test, QuestionState } from '../types';
import { LatexRenderer } from './LatexRenderer';
import { saveAttempt } from '../db';
import { 
  Tv, 
  HelpCircle, 
  AlertTriangle, 
  ChevronRight, 
  RotateCcw, 
  CheckCircle, 
  Maximize2, 
  User, 
  FileText, 
  Clock, 
  Layout, 
  CornerDownRight,
  ShieldAlert
} from 'lucide-react';

interface CbtExamEngineProps {
  test: Test;
  markingScheme: MarkingScheme;
  candidateName: string;
  onExamSubmitted: (attempt: Attempt) => void;
  onExit: () => void;
  resumeAttempt?: Attempt | null; // support resume state
}

export const CbtExamEngine: React.FC<CbtExamEngineProps> = ({
  test,
  markingScheme,
  candidateName,
  onExamSubmitted,
  onExit,
  resumeAttempt = null,
}) => {
  const [isStarted, setIsStarted] = useState(false);
  const [readInstructions, setReadInstructions] = useState(false);
  const [currentQuestionId, setCurrentQuestionId] = useState<string>('');
  const [responses, setResponses] = useState<Record<string, QuestionResponse>>({});
  const [timeLeft, setTimeLeft] = useState(180 * 60); // 3 hours in seconds
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [multiTabConflict, setMultiTabConflict] = useState(false);

  // Active Subject tab
  const [activeSubject, setActiveSubject] = useState<string>('');

  // Local storage session lease to prevent multi-tab corruption
  const attemptIdRef = useRef<string>(resumeAttempt?.id || Math.random().toString(36).slice(2));
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timeTrackingRef = useRef<Record<string, number>>({}); // tracks time spent on current question in seconds
  const lastTickRef = useRef<number>(Date.now());

  // Get list of distinct subjects
  const subjects = React.useMemo(() => {
    const list = Array.from(new Set(test.questions.map(q => q.subject)));
    return list.length > 0 ? list : ['Unclassified'];
  }, [test.questions]);

  // Group questions by subject
  const questionsBySubject = React.useMemo(() => {
    const groups: Record<string, Question[]> = {};
    subjects.forEach(sub => {
      groups[sub] = test.questions.filter(q => q.subject === sub);
    });
    return groups;
  }, [test.questions, subjects]);

  // Current question object
  const currentQuestion = React.useMemo(() => {
    return test.questions.find(q => q.id === currentQuestionId);
  }, [test.questions, currentQuestionId]);

  // Initialize Exam State
  useEffect(() => {
    if (resumeAttempt) {
      setResponses(resumeAttempt.responses);
      setTimeLeft(resumeAttempt.timeLeftSeconds);
      setTabSwitchCount(resumeAttempt.tabSwitchCount);
      setIsStarted(true);
      setReadInstructions(true);
      
      // Find first question ID
      if (test.questions.length > 0) {
        setCurrentQuestionId(test.questions[0].id);
        setActiveSubject(test.questions[0].subject);
      }
    } else {
      // Initialize fresh attempt state
      const initialResponses: Record<string, QuestionResponse> = {};
      test.questions.forEach((q, idx) => {
        initialResponses[q.id] = {
          questionId: q.id,
          answer: '',
          timeSpentSeconds: 0,
          isMarkedForReview: false,
          isAnswered: false,
          state: idx === 0 ? 'NOT_ANSWERED' : 'NOT_VISITED', // first question is instantly visited
          isCorrect: null,
          earnedMarks: null,
          selfAssessment: null
        };
      });

      setResponses(initialResponses);
      setTimeLeft(3 * 60 * 60); // 3 hours
      
      if (test.questions.length > 0) {
        setCurrentQuestionId(test.questions[0].id);
        setActiveSubject(test.questions[0].subject);
      }
    }

    // Register active attempt in local storage to block multi-tab corruption
    localStorage.setItem('jee_active_attempt_id', attemptIdRef.current);

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'jee_active_attempt_id' && e.newValue !== attemptIdRef.current) {
        setMultiTabConflict(true);
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    return () => {
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [test.questions, resumeAttempt]);

  // Fullscreen tracker
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Track compliance tab switching / blur
  useEffect(() => {
    if (!isStarted || multiTabConflict) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setTabSwitchCount(prev => prev + 1);
      }
    };

    const handleBlur = () => {
      setTabSwitchCount(prev => prev + 1);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isStarted, multiTabConflict]);

  // Heartbeat countdown timer & question time tracker
  useEffect(() => {
    if (!isStarted || multiTabConflict) return;

    lastTickRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const delta = Math.round((now - lastTickRef.current) / 1000);
      lastTickRef.current = now;

      // Update remaining test time
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // Auto submit on timeout
          triggerAutoSubmit();
          return 0;
        }
        return prev - delta;
      });

      // Track time on current question
      if (currentQuestionId) {
        timeTrackingRef.current[currentQuestionId] = (timeTrackingRef.current[currentQuestionId] || 0) + delta;
        
        // Staggered continuous auto-save
        setResponses(prev => {
          const entry = prev[currentQuestionId];
          if (entry) {
            return {
              ...prev,
              [currentQuestionId]: {
                ...entry,
                timeSpentSeconds: entry.timeSpentSeconds + delta
              }
            };
          }
          return prev;
        });
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStarted, currentQuestionId, multiTabConflict]);

  // Continuously persist state to IndexedDB when responses or time left change
  useEffect(() => {
    if (!isStarted || Object.keys(responses).length === 0) return;

    const attempt: Attempt = {
      id: attemptIdRef.current,
      testId: test.id,
      testName: test.name,
      candidateName,
      startTime: resumeAttempt?.startTime || Date.now(),
      endTime: null,
      timeLeftSeconds: timeLeft,
      responses,
      markingScheme,
      isSubmitted: false,
      tabSwitchCount,
    };

    saveAttempt(attempt).catch(err => console.error("Database save failed", err));
  }, [responses, timeLeft, tabSwitchCount, isStarted]);

  const enterFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (e) {}
  };

  const handleStartExam = () => {
    setIsStarted(true);
    enterFullscreen();
  };

  const handleVisitQuestion = (qId: string) => {
    // Determine the subject of the clicked question
    const qObj = test.questions.find(q => q.id === qId);
    if (qObj) {
      setActiveSubject(qObj.subject);
    }

    setResponses(prev => {
      const current = prev[qId];
      if (current && current.state === 'NOT_VISITED') {
        return {
          ...prev,
          [qId]: { ...current, state: 'NOT_ANSWERED' }
        };
      }
      return prev;
    });
    setCurrentQuestionId(qId);
  };

  // NTA Semantics: Save & Next
  const handleSaveAndNext = () => {
    if (!currentQuestionId) return;

    const answerValue = responses[currentQuestionId]?.answer || '';
    const hasAnswer = answerValue.trim() !== '';

    setResponses(prev => {
      const current = prev[currentQuestionId];
      const newState: QuestionState = hasAnswer ? 'ANSWERED' : 'NOT_ANSWERED';
      return {
        ...prev,
        [currentQuestionId]: {
          ...current,
          isAnswered: hasAnswer,
          isMarkedForReview: false,
          state: newState
        }
      };
    });

    goToNextQuestion();
  };

  // NTA Semantics: Mark for Review & Next
  const handleMarkForReviewAndNext = () => {
    if (!currentQuestionId) return;

    const answerValue = responses[currentQuestionId]?.answer || '';
    const hasAnswer = answerValue.trim() !== '';

    setResponses(prev => {
      const current = prev[currentQuestionId];
      const newState: QuestionState = hasAnswer 
        ? 'ANSWERED_AND_MARKED_FOR_REVIEW' 
        : 'MARKED_FOR_REVIEW';
      return {
        ...prev,
        [currentQuestionId]: {
          ...current,
          isMarkedForReview: true,
          state: newState
        }
      };
    });

    goToNextQuestion();
  };

  // NTA Semantics: Clear Response
  const handleClearResponse = () => {
    if (!currentQuestionId) return;

    setResponses(prev => {
      const current = prev[currentQuestionId];
      return {
        ...prev,
        [currentQuestionId]: {
          ...current,
          answer: '',
          isAnswered: false,
          isMarkedForReview: false,
          state: 'NOT_ANSWERED'
        }
      };
    });
  };

  const goToNextQuestion = () => {
    const currentIndex = test.questions.findIndex(q => q.id === currentQuestionId);
    if (currentIndex !== -1 && currentIndex < test.questions.length - 1) {
      const nextQId = test.questions[currentIndex + 1].id;
      handleVisitQuestion(nextQId);
    }
  };

  // Answer change handler
  const handleAnswerChange = (value: string) => {
    if (!currentQuestionId) return;

    // Filter numerical inputs to allow digits, decimal points, and minus signs only
    if (currentQuestion?.answerType === 'numerical') {
      const filtered = value.replace(/[^0-9.-]/g, '');
      setResponses(prev => ({
        ...prev,
        [currentQuestionId]: {
          ...prev[currentQuestionId],
          answer: filtered
        }
      }));
      return;
    }

    setResponses(prev => ({
      ...prev,
      [currentQuestionId]: {
        ...prev[currentQuestionId],
        answer: value
      }
    }));
  };

  // NTA Section stats counter
  const getSectionStats = (subject: string) => {
    const qList = questionsBySubject[subject] || [];
    let answered = 0;
    let notAnswered = 0;
    let marked = 0;
    let answeredMarked = 0;
    let notVisited = 0;

    qList.forEach(q => {
      const resp = responses[q.id];
      if (!resp) return;
      if (resp.state === 'NOT_VISITED') notVisited++;
      else if (resp.state === 'NOT_ANSWERED') notAnswered++;
      else if (resp.state === 'ANSWERED') answered++;
      else if (resp.state === 'MARKED_FOR_REVIEW') marked++;
      else if (resp.state === 'ANSWERED_AND_MARKED_FOR_REVIEW') answeredMarked++;
    });

    return { answered, notAnswered, marked, answeredMarked, notVisited, total: qList.length };
  };

  const getActiveSectionStats = () => {
    return getSectionStats(activeSubject);
  };

  // Formatting Timer HH:MM:SS
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Grade Objective Questions
  const gradeAttempt = (finalResponses: Record<string, QuestionResponse>): Record<string, QuestionResponse> => {
    const graded = { ...finalResponses };

    test.questions.forEach(q => {
      const resp = graded[q.id];
      if (!resp) return;

      const isAttempted = resp.answer.trim() !== '';

      if (!isAttempted) {
        resp.isCorrect = false;
        resp.earnedMarks = 0;
        return;
      }

      if (q.answerType === 'mcq') {
        const isCorrect = q.correctOption?.trim() === resp.answer.trim();
        resp.isCorrect = isCorrect;
        resp.earnedMarks = isCorrect ? markingScheme.mcqPositive : markingScheme.mcqNegative;
      } else if (q.answerType === 'numerical') {
        const userVal = parseFloat(resp.answer.trim());
        if (isNaN(userVal) || q.correctValue === null) {
          resp.isCorrect = false;
          resp.earnedMarks = markingScheme.numericalNoNegative ? 0 : markingScheme.numericalNegative;
        } else {
          const diff = Math.abs(userVal - q.correctValue);
          const tolerance = q.tolerance !== null ? q.tolerance : 0;
          const isCorrect = diff <= tolerance;
          resp.isCorrect = isCorrect;
          resp.earnedMarks = isCorrect 
            ? markingScheme.numericalPositive 
            : (markingScheme.numericalNoNegative ? 0 : markingScheme.numericalNegative);
        }
      } else if (q.answerType === 'subjective') {
        // Subjective questions cannot be auto-graded. 
        // We set to null to trigger self-assessment later on!
        resp.isCorrect = null;
        resp.earnedMarks = null;
      }
    });

    return graded;
  };

  // Trigger submission
  const executeSubmission = (currentResponses: Record<string, QuestionResponse>) => {
    if (timerRef.current) clearInterval(timerRef.current);

    // Grade objective responses
    const gradedResponses = gradeAttempt(currentResponses);

    const finalAttempt: Attempt = {
      id: attemptIdRef.current,
      testId: test.id,
      testName: test.name,
      candidateName,
      startTime: resumeAttempt?.startTime || Date.now(),
      endTime: Date.now(),
      timeLeftSeconds: timeLeft,
      responses: gradedResponses,
      markingScheme,
      isSubmitted: true,
      tabSwitchCount,
    };

    // Save final state to DB and callback
    saveAttempt(finalAttempt)
      .then(() => {
        // Exit fullscreen
        try {
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
        } catch (e) {}
        onExamSubmitted(finalAttempt);
      })
      .catch(err => {
        console.error("Submission save failed", err);
        onExamSubmitted(finalAttempt);
      });
  };

  const handleConfirmSubmit = () => {
    setIsSubmitModalOpen(false);
    executeSubmission(responses);
  };

  const triggerAutoSubmit = () => {
    // Auto-submit race condition compliance: fetch latest responses and submit immediately
    setResponses(latest => {
      executeSubmission(latest);
      return latest;
    });
  };

  const resumeMultiTabSession = () => {
    localStorage.setItem('jee_active_attempt_id', attemptIdRef.current);
    setMultiTabConflict(false);
  };

  // PRE-TEST Screen Layout
  if (!isStarted) {
    return (
      <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden animate-fade-in" id="pretest-panel">
        <div className="p-6 bg-slate-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-800">JEE Computer-Based Test (CBT)</h2>
              <p className="text-xs text-gray-500">Candidate: <span className="font-bold text-gray-700">{candidateName}</span> • Test: <span className="font-bold text-gray-700">{test.name}</span></p>
            </div>
          </div>
          <button onClick={onExit} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold rounded transition">
            Exit Portal
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">General Instructions</h3>
            
            <div className="text-xs text-gray-600 space-y-3 leading-relaxed overflow-y-auto max-h-80 pr-4">
              <p className="font-semibold text-gray-800">Please read the following instructions carefully before starting the exam:</p>
              
              <ol className="list-decimal pl-5 space-y-2.5">
                <li>
                  <span className="font-semibold text-gray-800">Duration:</span> The total duration of this practice test is <span className="font-semibold text-gray-800">3 hours (180 minutes)</span>. The server timer is started at launch.
                </li>
                <li>
                  The countdown timer in the top-right corner of the screen will display the remaining time available to you. When the timer reaches zero, the test will <span className="font-semibold text-blue-600">auto-submit automatically</span>. Any answered questions will be saved.
                </li>
                <li>
                  The Question Palette displayed on the right side of screen will show the status of each question using one of the following symbols:
                  <div className="grid grid-cols-2 gap-2 mt-2 pl-4">
                    <div className="flex items-center gap-2"><span className="w-5 h-5 bg-gray-200 text-gray-700 text-[10px] font-bold rounded flex items-center justify-center">1</span> <span>Not Visited (Grey)</span></div>
                    <div className="flex items-center gap-2"><span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded flex items-center justify-center">2</span> <span>Not Answered (Red)</span></div>
                    <div className="flex items-center gap-2"><span className="w-5 h-5 bg-green-500 text-white text-[10px] font-bold rounded flex items-center justify-center">3</span> <span>Answered (Green)</span></div>
                    <div className="flex items-center gap-2"><span className="w-5 h-5 bg-purple-500 text-white text-[10px] font-bold rounded flex items-center justify-center">4</span> <span>Marked for Review (Purple)</span></div>
                    <div className="flex items-center gap-2">
                      <div className="relative w-5 h-5 bg-purple-500 text-white text-[10px] font-bold rounded flex items-center justify-center">
                        5
                        <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-white" />
                      </div>
                      <span>Answered & Marked for Review (Dot)</span>
                    </div>
                  </div>
                </li>
                <li>
                  <span className="font-semibold text-gray-800">Navigating to a Question:</span> Click on the question number in the Question Palette on the right to go to that question directly.
                </li>
                <li>
                  <span className="font-semibold text-gray-800">Answering a Question:</span>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>For MCQ: Click the option radio button.</li>
                    <li>For Numerical: Enter the numeric value using your keyboard (only numbers, decimal points, and signs are accepted).</li>
                    <li>For Subjective: Enter the detailed textual answer.</li>
                  </ul>
                </li>
                <li>
                  To save your answer, you <span className="font-semibold text-gray-800">MUST click "Save & Next"</span>. Clicking "Mark for Review & Next" will save the state for evaluation review, but does not commit an objective answer unless a choice was recorded.
                </li>
                <li>
                  <span className="font-semibold text-yellow-600">Compliance & Security:</span> This CBT simulator includes active fullscreen detection and tab-switch monitoring to emulate actual testing standards. Switching tabs or leaving the screen records compliance exceptions.
                </li>
              </ol>
            </div>
          </div>

          {/* Declaration Checkbox */}
          <div className="bg-blue-50/55 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
            <input
              type="checkbox"
              id="declaration"
              checked={readInstructions}
              onChange={(e) => setReadInstructions(e.target.checked)}
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="declaration" className="text-xs text-gray-700 leading-relaxed cursor-pointer select-none">
              <span className="font-bold text-gray-900">Declaration:</span> I have read and understood all the general instructions. I agree that in case of any tab-switching, my activity log will reflect compliance statistics. I am ready to begin the test.
            </label>
          </div>
        </div>

        <div className="p-5 bg-slate-50 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onExit}
            className="px-5 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            disabled={!readInstructions}
            onClick={handleStartExam}
            className={`px-8 py-2 text-sm font-bold rounded-lg shadow-sm transition ${
              readInstructions
                ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer hover:shadow-md'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            I am Ready to Begin
          </button>
        </div>
      </div>
    );
  }

  // MULTI-TAB BLOCKER SCREEN
  if (multiTabConflict) {
    return (
      <div className="max-w-md mx-auto bg-white border border-red-200 rounded-xl shadow-lg p-8 text-center space-y-6 my-12 animate-fade-in">
        <div className="p-4 bg-red-50 text-red-600 rounded-full inline-block">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-gray-900">Active Session Blocker</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            This exam attempt is currently open in another browser tab. To prevent database synchronization conflict and multi-tab corruption, this window has been suspended.
          </p>
        </div>
        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={resumeMultiTabSession}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg shadow transition"
          >
            Resume Session Here
          </button>
          <button
            onClick={onExit}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold rounded-lg transition"
          >
            Exit Exam
          </button>
        </div>
      </div>
    );
  }

  // ACTIVE CBT EXAM SCREEN
  return (
    <div className="w-full flex flex-col bg-slate-100 border border-gray-300 rounded-lg shadow-md overflow-hidden" style={{ minHeight: '600px' }} id="cbt-engine-root">
      
      {/* 3.2 PERSISTENT HEADER BAR */}
      <div className="bg-[#1e293b] text-white px-5 py-3 flex flex-wrap items-center justify-between border-b border-slate-700">
        <div>
          <h2 className="text-sm font-extrabold tracking-wide uppercase text-blue-400">JEE Computer-Based Test (CBT)</h2>
          <p className="text-xs text-slate-300 mt-0.5">Test: <span className="font-bold text-white">{test.name}</span></p>
        </div>

        {/* Live Timer & Candidate Name Panel */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded border border-slate-700 text-xs">
            <User className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-medium text-slate-300">Candidate: <span className="text-white font-bold">{candidateName}</span></span>
          </div>

          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded border border-slate-700 text-xs font-mono text-yellow-400 font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>Time Left: {formatTime(timeLeft)}</span>
          </div>

          {!isFullscreen && (
            <button
              onClick={enterFullscreen}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition"
              title="Enter Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 3.3 SUBJECT NAVIGATION TABS */}
      <div className="bg-slate-200 border-b border-gray-300 flex items-center justify-between">
        <div className="flex overflow-x-auto">
          {subjects.map(sub => (
            <button
              key={sub}
              onClick={() => {
                setActiveSubject(sub);
                // Switch to first question of this subject
                const subQ = questionsBySubject[sub];
                if (subQ && subQ.length > 0) {
                  handleVisitQuestion(subQ[0].id);
                }
              }}
              className={`px-6 py-2.5 text-xs font-bold uppercase tracking-wider border-r border-gray-300 transition ${
                activeSubject === sub
                  ? 'bg-white text-blue-700 border-b-2 border-b-blue-600'
                  : 'text-gray-600 hover:bg-slate-300 hover:text-gray-900'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
        
        {tabSwitchCount > 0 && (
          <div className="px-4 py-1.5 bg-yellow-50 border-l border-yellow-200 text-yellow-700 flex items-center gap-1 text-[11px] font-bold">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Warning: {tabSwitchCount} Tab Switches Detected</span>
          </div>
        )}
      </div>

      {/* TWO-COLUMN CONTENT AREA */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 bg-white" style={{ minHeight: '450px' }}>
        
        {/* LEFT COLUMN: CENTRAL QUESTION PANEL & ACTION BAR (3/4 Width) */}
        <div className="lg:col-span-3 flex flex-col border-r border-gray-300">
          
          {/* Question Header */}
          <div className="px-5 py-3 border-b border-gray-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-blue-600 text-white font-bold text-xs rounded">
                Question {currentQuestion?.id}
              </span>
              <span className="text-xs text-gray-500">
                Section: <span className="font-semibold text-gray-700">{currentQuestion?.subject}</span>
              </span>
              {currentQuestion?.topic && (
                <span className="text-xs text-gray-400">
                  ({currentQuestion.topic})
                </span>
              )}
            </div>

            {/* Marking indicator */}
            <div className="text-xs font-bold text-gray-600 flex items-center gap-2">
              <span>Marks: </span>
              <span className="px-1.5 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded">
                +{currentQuestion?.answerType === 'mcq' ? markingScheme.mcqPositive : markingScheme.numericalPositive}
              </span>
              <span className="px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded">
                {currentQuestion?.answerType === 'mcq' 
                  ? markingScheme.mcqNegative 
                  : (markingScheme.numericalNoNegative ? '0' : markingScheme.numericalNegative)}
              </span>
            </div>
          </div>

          {/* Rendered Question Body via KaTeX (3.4) */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            <div className="prose max-w-none">
              {currentQuestion ? (
                <LatexRenderer text={currentQuestion.body} />
              ) : (
                <span className="text-gray-400">No question selected</span>
              )}
            </div>

            {/* Response Input Controls based on Answer Type */}
            {currentQuestion && (
              <div className="border-t border-gray-100 pt-6">
                
                {/* MCQ Layout (Single-Select Radio) */}
                {currentQuestion.answerType === 'mcq' && (
                  <div className="space-y-3">
                    {currentQuestion.options.map((opt, oIdx) => (
                      <label
                        key={oIdx}
                        className={`flex items-start gap-3 p-3.5 border rounded-lg cursor-pointer transition select-none ${
                          responses[currentQuestion.id]?.answer === opt
                            ? 'border-blue-500 bg-blue-50/40 text-blue-900 font-medium'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${currentQuestion.id}`}
                          value={opt}
                          checked={responses[currentQuestion.id]?.answer === opt}
                          onChange={() => handleAnswerChange(opt)}
                          className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <div className="text-sm">
                          <span className="font-semibold text-gray-500 mr-2">{String.fromCharCode(65 + oIdx)}.</span>
                          <LatexRenderer text={opt} />
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {/* Numerical Input Box (Filter-Locked) */}
                {currentQuestion.answerType === 'numerical' && (
                  <div className="max-w-xs space-y-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Enter Numeric Response:
                    </label>
                    <input
                      type="text"
                      pattern="[0-9.-]*"
                      value={responses[currentQuestion.id]?.answer || ''}
                      onChange={(e) => handleAnswerChange(e.target.value)}
                      className="w-full font-mono text-sm px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder:text-gray-300"
                      placeholder="Only digits, decimal, and minus"
                    />
                    <p className="text-[11px] text-gray-400">
                      Standard integer or floating response (e.g. 4 or 23.10). Decimal rounding is supported.
                    </p>
                  </div>
                )}

                {/* Subjective Free Text Editor */}
                {currentQuestion.answerType === 'subjective' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Enter Subjective Explanatory Answer:
                    </label>
                    <textarea
                      value={responses[currentQuestion.id]?.answer || ''}
                      onChange={(e) => handleAnswerChange(e.target.value)}
                      className="w-full text-sm p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none h-44 resize-none"
                      placeholder="Type your complete solution text or formulas here. This will be compared against the model answer after test submission."
                    />
                  </div>
                )}

              </div>
            )}
          </div>

          {/* 3.6 ACTION CONTROL BAR */}
          <div className="px-5 py-3.5 bg-slate-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2.5 select-none">
            
            <div className="flex gap-2">
              <button
                onClick={handleMarkForReviewAndNext}
                className="px-4 py-2 border border-purple-300 text-purple-700 hover:bg-purple-50 text-xs font-bold rounded transition flex items-center gap-1 shadow-sm"
              >
                Mark for Review & Next
              </button>
              <button
                onClick={handleClearResponse}
                className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-100 text-xs font-bold rounded transition shadow-sm"
              >
                Clear Response
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSaveAndNext}
                className="px-6 py-2 bg-[#1e3a8a] hover:bg-[#172554] text-white text-xs font-bold rounded transition flex items-center gap-1 shadow hover:shadow-md"
              >
                Save & Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              
              <button
                onClick={() => setIsSubmitModalOpen(true)}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded transition shadow hover:shadow-md"
              >
                Submit Test
              </button>
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: PALETTE PANEL & LEGEND (1/4 Width) (3.5) */}
        <div className="lg:col-span-1 bg-slate-50 flex flex-col p-4 border-t lg:border-t-0 border-gray-300">
          
          {/* Running counters */}
          <div className="mb-4">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 pb-1.5 border-b border-gray-200 flex items-center gap-1">
              <Layout className="w-3.5 h-3.5" />
              Palette Legend ({activeSubject})
            </h3>
            
            {/* Counts grid */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-gray-600">
              <div className="flex items-center gap-1.5 bg-white p-1 border border-gray-100 rounded">
                <span className="w-4 h-4 bg-green-500 rounded text-white flex items-center justify-center font-bold text-[9px]">{getActiveSectionStats().answered}</span>
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white p-1 border border-gray-100 rounded">
                <span className="w-4 h-4 bg-red-500 rounded text-white flex items-center justify-center font-bold text-[9px]">{getActiveSectionStats().notAnswered}</span>
                <span>Not Answered</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white p-1 border border-gray-100 rounded">
                <span className="w-4 h-4 bg-purple-500 rounded text-white flex items-center justify-center font-bold text-[9px]">{getActiveSectionStats().marked}</span>
                <span>Marked</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white p-1 border border-gray-100 rounded">
                <span className="w-4 h-4 bg-gray-200 rounded text-gray-700 flex items-center justify-center font-bold text-[9px]">{getActiveSectionStats().notVisited}</span>
                <span>Not Visited</span>
              </div>
              <div className="col-span-2 flex items-center gap-1.5 bg-white p-1 border border-gray-100 rounded">
                <div className="relative w-4 h-4 bg-purple-500 rounded text-white flex items-center justify-center font-bold text-[9px]">
                  MR
                  <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-green-500 rounded-full border border-white" />
                </div>
                <span>Answered & Marked for Review</span>
              </div>
            </div>
          </div>

          {/* PALETTE GRID */}
          <div className="flex-1 flex flex-col min-h-[220px]">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Questions Navigation
            </h3>

            <div className="flex-1 overflow-y-auto max-h-[260px] pr-1">
              <div className="grid grid-cols-5 gap-1.5">
                {questionsBySubject[activeSubject]?.map((q, qIdx) => {
                  const resp = responses[q.id];
                  let btnStyle = 'bg-gray-200 text-gray-700 hover:bg-gray-300'; // NOT_VISITED

                  if (resp) {
                    if (resp.state === 'NOT_ANSWERED') {
                      btnStyle = 'bg-red-500 text-white hover:bg-red-600';
                    } else if (resp.state === 'ANSWERED') {
                      btnStyle = 'bg-green-500 text-white hover:bg-green-600';
                    } else if (resp.state === 'MARKED_FOR_REVIEW') {
                      btnStyle = 'bg-purple-500 text-white hover:bg-purple-600';
                    } else if (resp.state === 'ANSWERED_AND_MARKED_FOR_REVIEW') {
                      btnStyle = 'bg-purple-500 text-white hover:bg-purple-600';
                    }
                  }

                  const isCurrent = q.id === currentQuestionId;

                  return (
                    <button
                      key={q.id}
                      onClick={() => handleVisitQuestion(q.id)}
                      className={`relative aspect-square text-xs font-bold rounded transition flex items-center justify-center border select-none ${btnStyle} ${
                        isCurrent ? 'ring-2 ring-blue-600 border-white z-10 scale-105' : 'border-transparent'
                      }`}
                    >
                      {qIdx + 1}
                      
                      {/* Answered and Marked visual dot indicator */}
                      {resp?.state === 'ANSWERED_AND_MARKED_FOR_REVIEW' && (
                        <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 bg-green-400 rounded-full border border-white" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Instruction details footer */}
          <div className="mt-4 p-2 bg-blue-50/55 rounded border border-blue-100 text-[10px] text-gray-500 space-y-1">
            <p className="font-bold text-gray-700">Exam Instructions:</p>
            <p>You can jump freely between subjects and question palettes. Click Submit Test to review and finalize.</p>
          </div>

        </div>

      </div>

      {/* 3.7 SUBMIT FLOW CONFIRMATION MODAL */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none animate-fade-in" id="submit-modal">
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xl max-w-xl w-full p-6 space-y-4">
            <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Confirm Examination Submission
            </h3>
            
            <p className="text-xs text-gray-500 leading-relaxed">
              You are about to submit your JEE Computer-Based Test response sheet. Please review your attempt distribution metrics across subjects before confirming submission.
            </p>

            {/* Summary Grid */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-gray-700 font-bold border-b border-gray-200">
                    <th className="p-2 border-r border-gray-200">Subject</th>
                    <th className="p-2 border-r border-gray-200 text-center">Ans</th>
                    <th className="p-2 border-r border-gray-200 text-center">Not Ans</th>
                    <th className="p-2 border-r border-gray-200 text-center">Marked</th>
                    <th className="p-2 border-r border-gray-200 text-center">Ans+Mkd</th>
                    <th className="p-2 text-center">Not Visited</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {subjects.map(sub => {
                    const stats = getSectionStats(sub);
                    return (
                      <tr key={sub} className="hover:bg-slate-50/50">
                        <td className="p-2 font-bold border-r border-gray-200 text-gray-700">{sub}</td>
                        <td className="p-2 border-r border-gray-200 text-center text-green-600 font-bold">{stats.answered}</td>
                        <td className="p-2 border-r border-gray-200 text-center text-red-500 font-bold">{stats.notAnswered}</td>
                        <td className="p-2 border-r border-gray-200 text-center text-purple-600 font-bold">{stats.marked}</td>
                        <td className="p-2 border-r border-gray-200 text-center text-purple-600 font-bold">{stats.answeredMarked}</td>
                        <td className="p-2 text-center text-gray-400 font-bold">{stats.notVisited}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Warning details */}
            <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg flex gap-2 items-start text-xs text-yellow-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold">Important Warning</p>
                <p className="text-[11px] leading-relaxed">Once submitted, you cannot resume or alter your responses. All answered and answered-marked questions will be auto-graded according to your active marking rules.</p>
              </div>
            </div>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold text-xs rounded-lg transition"
              >
                Go Back to Exam
              </button>
              <button
                onClick={handleConfirmSubmit}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-lg shadow transition"
              >
                Confirm Submit
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default CbtExamEngine;
