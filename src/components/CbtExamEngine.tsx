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
  ChevronLeft,
  RotateCcw, 
  CheckCircle, 
  Maximize2, 
  User, 
  FileText, 
  Clock, 
  Layout, 
  CornerDownRight,
  ShieldAlert,
  Info,
  X,
  Grid,
  Check
} from 'lucide-react';

interface CbtExamEngineProps {
  test: Test;
  markingScheme: MarkingScheme;
  candidateName: string;
  onExamSubmitted: (attempt: Attempt) => void;
  onExit: () => void;
  resumeAttempt?: Attempt | null; // support resume state
}

export const JeeShapeIcon: React.FC<{
  type: 'NOT_VISITED' | 'NOT_ANSWERED' | 'ANSWERED' | 'MARKED_FOR_REVIEW' | 'ANSWERED_AND_MARKED_FOR_REVIEW';
  text: string;
  size?: string;
}> = ({ type, text, size = 'w-9 h-9' }) => {
  let content = null;

  switch (type) {
    case 'NOT_VISITED':
      content = (
        <svg viewBox="0 0 42 42" className="w-full h-full">
          <rect x="3" y="3" width="36" height="36" rx="4" fill="#ffffff" stroke="#94a3b8" strokeWidth="1" />
          <text x="21" y="25" textAnchor="middle" fill="#334155" fontSize="12" fontWeight="bold">{text}</text>
        </svg>
      );
      break;
    case 'NOT_ANSWERED':
      content = (
        <svg viewBox="0 0 42 42" className="w-full h-full">
          <path d="M 3 3 L 39 3 L 39 27 L 21 39 L 3 27 Z" fill="#e03b24" />
          <text x="21" y="22" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">{text}</text>
        </svg>
      );
      break;
    case 'ANSWERED':
      content = (
        <svg viewBox="0 0 42 42" className="w-full h-full">
          <path d="M 3 39 L 39 39 L 39 15 L 21 3 L 3 15 Z" fill="#2baf2b" />
          <text x="21" y="28" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">{text}</text>
        </svg>
      );
      break;
    case 'MARKED_FOR_REVIEW':
      content = (
        <svg viewBox="0 0 42 42" className="w-full h-full">
          <circle cx="21" cy="21" r="17" fill="#7c3aed" />
          <text x="21" y="25" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">{text}</text>
        </svg>
      );
      break;
    case 'ANSWERED_AND_MARKED_FOR_REVIEW':
      content = (
        <svg viewBox="0 0 42 42" className="w-full h-full">
          <circle cx="21" cy="21" r="17" fill="#7c3aed" />
          <circle cx="32" cy="32" r="6" fill="#2baf2b" />
          <circle cx="32" cy="32" r="2" fill="#ffffff" />
          <text x="21" y="25" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">{text}</text>
        </svg>
      );
      break;
  }

  return <div className={`${size} flex-shrink-0 select-none`}>{content}</div>;
};

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
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [multiTabConflict, setMultiTabConflict] = useState(false);
  const [examEndTimestamp, setExamEndTimestamp] = useState<number>(0);

  // Active Subject tab
  const [activeSubject, setActiveSubject] = useState<string>('');

  // Custom visual state controls
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [textSize, setTextSize] = useState<'sm' | 'base' | 'lg'>('base');
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
  const [isQuestionPaperModalOpen, setIsQuestionPaperModalOpen] = useState(false);

  const getDeviceId = () => {
    let id = localStorage.getItem('jee_device_id');
    if (!id) {
      id = Math.random().toString(36).substring(2);
      localStorage.setItem('jee_device_id', id);
    }
    return id;
  };

  // Local storage session lease to prevent multi-tab corruption
  const attemptIdRef = useRef<string>(resumeAttempt?.id || Math.random().toString(36).slice(2));
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const hasSubmittedRef = useRef(false);

  // Performance-optimizing state references to avoid timer write-storm
  const currentQuestionIdRef = useRef<string>(currentQuestionId);
  const dirtyRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(resumeAttempt?.startTime || Date.now());
  const timeLeftRef = useRef<number>(180 * 60);
  const responsesRef = useRef<Record<string, QuestionResponse>>({});
  const tabSwitchCountRef = useRef<number>(0);
  const lastViolationRef = useRef<number>(0);
  const touchStartRef = useRef<number | null>(null);
  const touchEndRef = useRef<number | null>(null);

  // Sync state refs with active React states
  useEffect(() => {
    currentQuestionIdRef.current = currentQuestionId;
  }, [currentQuestionId]);

  // Wrappers to guarantee synchronous ref updates for persistence
  const [responsesState, _setResponses] = useState<Record<string, QuestionResponse>>({});
  const setResponses = (updater: React.SetStateAction<Record<string, QuestionResponse>>) => {
    _setResponses(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      responsesRef.current = next;
      dirtyRef.current = true;
      return next;
    });
  };
  const responses = responsesState;

  const [tabSwitchCountState, _setTabSwitchCount] = useState(0);
  const setTabSwitchCount = (updater: React.SetStateAction<number>) => {
    _setTabSwitchCount(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      tabSwitchCountRef.current = next;
      dirtyRef.current = true;
      return next;
    });
  };
  const tabSwitchCount = tabSwitchCountState;

  const [timeLeftState, _setTimeLeft] = useState(180 * 60);
  const setTimeLeft = (updater: React.SetStateAction<number>) => {
    _setTimeLeft(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      timeLeftRef.current = next;
      return next;
    });
  };
  const timeLeft = timeLeftState;

  // Flush to IndexedDB only when dirty
  const flushToStorage = (forceHeartbeat = false) => {
    if (!isStarted || multiTabConflict || Object.keys(responsesRef.current).length === 0) return;
    if (!dirtyRef.current && !forceHeartbeat) return;

    const attempt: Attempt = {
      id: attemptIdRef.current,
      testId: test.id,
      testName: test.name,
      candidateName,
      startTime: startTimeRef.current,
      endTime: null,
      timeLeftSeconds: timeLeftRef.current,
      examEndTimestamp,
      responses: responsesRef.current,
      markingScheme,
      isSubmitted: false,
      tabSwitchCount: tabSwitchCountRef.current,
      deviceId: getDeviceId(),
      lastHeartbeatAt: Date.now()
    };

    saveAttempt(attempt)
      .then(() => {
        dirtyRef.current = false;
      })
      .catch(err => console.error("Database save failed", err));
  };

  // Run periodic flush to db every 10 seconds
  useEffect(() => {
    if (!isStarted || multiTabConflict) return;

    const interval = setInterval(() => {
      flushToStorage(true); // force heartbeat
    }, 10000);

    return () => clearInterval(interval);
  }, [isStarted, multiTabConflict]);

  // Flush on visibility changes (hidden) or before page unload to prevent data loss
  useEffect(() => {
    if (!isStarted) return;

    const handleBeforeUnload = () => {
      flushToStorage();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushToStorage();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isStarted]);

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
    const deviceId = getDeviceId();
    
    if (resumeAttempt) {
      if (resumeAttempt.deviceId && resumeAttempt.deviceId !== deviceId) {
        const isAlive = resumeAttempt.lastHeartbeatAt && (Date.now() - resumeAttempt.lastHeartbeatAt < 20000);
        if (isAlive) {
          setMultiTabConflict(true);
          return;
        }
      }

      setResponses(resumeAttempt.responses);
      setTimeLeft(resumeAttempt.timeLeftSeconds);
      setTabSwitchCount(resumeAttempt.tabSwitchCount);
      setExamEndTimestamp(resumeAttempt.examEndTimestamp || (Date.now() + (resumeAttempt.timeLeftSeconds * 1000)));
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
      setExamEndTimestamp(Date.now() + 3 * 60 * 60 * 1000);
      
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

  // Fullscreen support feature-detection
  const isFullscreenSupported = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;
  const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  const useImmersiveFallback = !isFullscreenSupported || isIOS;

  // Fullscreen tracker
  useEffect(() => {
    if (useImmersiveFallback) return;

    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [useImmersiveFallback]);

  // Track compliance tab switching / blur with debouncing
  useEffect(() => {
    if (!isStarted || multiTabConflict) return;

    const handleViolation = () => {
      const now = Date.now();
      if (now - lastViolationRef.current < 400) {
        return; // debounce duplicate firing
      }
      lastViolationRef.current = now;
      setTabSwitchCount(prev => prev + 1);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleViolation();
      }
    };

    const handleBlur = () => {
      handleViolation();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isStarted, multiTabConflict]);

  // Heartbeat countdown timer & question time tracker (Does not churn on question navigation!)
  useEffect(() => {
    if (!isStarted || multiTabConflict) return;

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.round((examEndTimestamp - now) / 1000));
      
      // Update time tracking for the active question
      const activeQId = currentQuestionIdRef.current;
      if (activeQId) {
        const delta = Math.round((now - lastTickRef.current) / 1000);
        if (delta > 0) {
          setResponses(prev => {
            const entry = prev[activeQId];
            if (entry) {
              return {
                ...prev,
                [activeQId]: {
                  ...entry,
                  timeSpentSeconds: entry.timeSpentSeconds + delta
                }
              };
            }
            return prev;
          });
        }
      }

      lastTickRef.current = now;
      setTimeLeft(remaining);

      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        triggerAutoSubmit();
      }
    };

    lastTickRef.current = Date.now();
    timerRef.current = setInterval(tick, 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick(); // Force recompute accurately on foreground
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isStarted, multiTabConflict, examEndTimestamp]);

  const enterFullscreen = () => {
    if (useImmersiveFallback) {
      setIsFullscreen(true);
    } else {
      try {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen()
            .then(() => setIsFullscreen(true))
            .catch(() => {
              setIsFullscreen(true); // fall back to immersive if rejected
            });
        } else {
          setIsFullscreen(true);
        }
      } catch (e) {
        setIsFullscreen(true);
      }
    }
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

    const isNumerical = currentQuestion?.answerType === 'numerical';
    const filteredValue = isNumerical ? value.replace(/[^0-9.-]/g, '') : value;

    setResponses(prev => {
      const current = prev[currentQuestionId];
      
      // I2: State Machine Closure - Modifying an answer dirties the state.
      // It must be downgraded from a committed state until Save & Next is clicked.
      let newState = current.state;
      if (newState === 'ANSWERED') newState = 'NOT_ANSWERED';
      if (newState === 'ANSWERED_AND_MARKED_FOR_REVIEW') newState = 'MARKED_FOR_REVIEW';

      return {
        ...prev,
        [currentQuestionId]: {
          ...current,
          answer: filteredValue,
          state: newState,
          isAnswered: false // Pending commit via Save & Next
        }
      };
    });
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

      const isValidState = resp.state === 'ANSWERED' || resp.state === 'ANSWERED_AND_MARKED_FOR_REVIEW';
      const isAttempted = isValidState && resp.answer.trim() !== '';

      if (!isAttempted) {
        resp.isCorrect = false;
        resp.earnedMarks = 0;
        return;
      }

      if (q.answerType === 'mcq') {
        const isCorrect = q.correctOptionId === resp.answer;
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
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    if (timerRef.current) clearInterval(timerRef.current);

    // Grade objective responses
    const gradedResponses = gradeAttempt(currentResponses);

    const finalAttempt: Attempt = {
      id: attemptIdRef.current,
      testId: test.id,
      testName: test.name,
      candidateName,
      startTime: startTimeRef.current,
      endTime: Date.now(),
      timeLeftSeconds: timeLeftRef.current,
      examEndTimestamp,
      responses: gradedResponses,
      markingScheme,
      isSubmitted: true,
      tabSwitchCount: tabSwitchCountRef.current,
      deviceId: getDeviceId(),
      lastHeartbeatAt: Date.now()
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
    executeSubmission(responsesRef.current);
  };

  const triggerAutoSubmit = () => {
    executeSubmission(responsesRef.current);
  };

  const resumeMultiTabSession = () => {
    localStorage.setItem('jee_active_attempt_id', attemptIdRef.current);
    setMultiTabConflict(false);
  };

  // PRE-TEST Screen Layout
  if (!isStarted) {
    return (
      <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden animate-fade-in" id="pretest-panel">
        <div className="p-4 sm:p-6 bg-slate-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-gray-800">JEE Computer-Based Test (CBT)</h2>
              <p className="text-xs text-gray-500">Candidate: <span className="font-bold text-gray-700">{candidateName}</span> • Test: <span className="font-bold text-gray-700">{test.name}</span></p>
            </div>
          </div>
          <button onClick={onExit} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold rounded-lg transition self-start sm:self-center">
            Exit Portal
          </button>
        </div>

        <div className="p-4 sm:p-8 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm sm:text-base font-bold text-gray-900 border-b border-gray-100 pb-2">General Instructions</h3>
            
            <div className="text-xs text-gray-600 space-y-3 leading-relaxed overflow-y-auto max-h-80 pr-2 sm:pr-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pl-2 sm:pl-4">
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
          <div className="bg-blue-50/55 border border-blue-100 rounded-lg p-3 sm:p-4 flex items-start gap-3">
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

        <div className="p-4 sm:p-5 bg-slate-50 border-t border-gray-200 flex flex-col-reverse sm:flex-row justify-end gap-3">
          <button
            onClick={onExit}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition text-center"
          >
            Cancel
          </button>
          <button
            disabled={!readInstructions}
            onClick={handleStartExam}
            className={`w-full sm:w-auto px-8 py-2.5 text-xs font-black rounded-lg shadow-sm transition text-center ${
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
  }  // ACTIVE CBT EXAM SCREEN
  const currentSubjectIndex = (questionsBySubject[activeSubject] || []).findIndex(q => q.id === currentQuestionId) + 1;
  
  const activeQuestionMarks = currentQuestion ? (
    currentQuestion.answerType === 'mcq' ? { pos: markingScheme.mcqPositive, neg: Math.abs(markingScheme.mcqNegative) } :
    currentQuestion.answerType === 'numerical' ? { pos: markingScheme.numericalPositive, neg: markingScheme.numericalNoNegative ? 0 : Math.abs(markingScheme.numericalNegative) } :
    { pos: markingScheme.subjectivePositive, neg: Math.abs(markingScheme.subjectiveNegative) }
  ) : { pos: 4, neg: 1 };

  const getTextSizeClass = () => {
    switch (textSize) {
      case 'sm': return 'text-xs md:text-sm';
      case 'lg': return 'text-base md:text-lg';
      default: return 'text-sm md:text-base';
    }
  };

  const handleIncreaseTextSize = () => {
    if (textSize === 'sm') setTextSize('base');
    else if (textSize === 'base') setTextSize('lg');
  };

  const handleDecreaseTextSize = () => {
    if (textSize === 'lg') setTextSize('base');
    else if (textSize === 'base') setTextSize('sm');
  };

  const goToPreviousQuestion = () => {
    const currentIndex = test.questions.findIndex(q => q.id === currentQuestionId);
    if (currentIndex > 0) {
      const prevQId = test.questions[currentIndex - 1].id;
      handleVisitQuestion(prevQId);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartRef.current === null || touchEndRef.current === null) return;
    const diff = touchStartRef.current - touchEndRef.current;
    const minSwipeDistance = 50; // pixels

    if (diff > minSwipeDistance) {
      // Swiped left -> Next Question
      goToNextQuestion();
    } else if (diff < -minSwipeDistance) {
      // Swiped right -> Previous Question
      goToPreviousQuestion();
    }

    touchStartRef.current = null;
    touchEndRef.current = null;
  };

  const activeSubjectQuestions = questionsBySubject[activeSubject] || [];

  const sectionTypes = Array.from(new Set(activeSubjectQuestions.map(q => q.answerType))) as string[];

  const getSectionLabel = (type: string) => {
    if (type === 'mcq') return 'MCQ Single';
    if (type === 'numerical') return 'Numeric Response';
    return 'Subjective';
  };

  const handleSectionTabClick = (type: string) => {
    const targetQ = activeSubjectQuestions.find(q => q.answerType === type);
    if (targetQ) {
      handleVisitQuestion(targetQ.id);
    }
  };

  return (
    <div className="w-full flex flex-col bg-white border border-gray-300 rounded-lg shadow-xl overflow-hidden select-none min-h-[500px] lg:min-h-[680px]" id="cbt-engine-root">
      
      {/* 3.2 PERSISTENT HEADER BAR (JEE Standard) */}
      <div className="bg-[#1e293b] text-white px-3 md:px-5 py-2.5 md:py-3 flex flex-wrap items-center justify-between border-b border-slate-700 gap-2">
        <div className="flex items-center gap-2 md:gap-3">
          <span className="text-yellow-400 font-black text-xs md:text-sm tracking-wide uppercase">IIT JEE Mains CBT Portal</span>
          <span className="hidden md:inline text-[10px] text-slate-400 border-l border-slate-700 pl-3">Standard Emulator v2.5</span>
        </div>

        {/* Global Action Keys & Modals Trigger */}
        <div className="flex items-center gap-1.5 md:gap-2">
          <button
            onClick={() => setIsQuestionPaperModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 md:px-3 py-1.5 rounded-md text-[10px] md:text-xs font-extrabold flex items-center gap-1 md:gap-1.5 transition cursor-pointer shadow-sm"
          >
            <FileText className="w-3 h-3 md:w-3.5 md:h-3.5" />
            Paper
          </button>
          
          <button
            onClick={() => setIsInstructionsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 md:px-3 py-1.5 rounded-md text-[10px] md:text-xs font-extrabold flex items-center gap-1 md:gap-1.5 transition cursor-pointer shadow-sm"
          >
            <HelpCircle className="w-3 h-3 md:w-3.5 md:h-3.5" />
            Instructions
          </button>

          {!isFullscreen && (
            <button
              onClick={enterFullscreen}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-slate-300 hover:text-white transition ml-1"
              title="Enter Fullscreen Mode"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* THREE-COLUMN LAYOUT CONTEXT */}
      <div className="flex-1 flex flex-row relative min-h-[500px] lg:min-h-[520px]">
        
        {/* LEFT COLUMN: PRIMARY WORKSPACE & ACTION PANEL */}
        <div className="flex-1 flex flex-col min-w-0 bg-white relative">
          
          {/* SUBJECT TABS BAR */}
          <div className="bg-slate-100 border-b border-gray-300 flex flex-col sm:flex-row sm:items-center justify-between px-2 py-1 sm:py-0 gap-2">
            <div className="flex overflow-x-auto flex-nowrap whitespace-nowrap scrollbar-thin scrollbar-thumb-gray-300">
              {subjects.map(sub => (
                <button
                  key={sub}
                  onClick={() => {
                    setActiveSubject(sub);
                    const subQ = questionsBySubject[sub];
                    if (subQ && subQ.length > 0) {
                      handleVisitQuestion(subQ[0].id);
                    }
                  }}
                  className={`px-4 md:px-5 py-3 md:py-3.5 min-h-[44px] md:min-h-0 text-[11px] md:text-xs font-black uppercase tracking-wider border-r border-gray-300 transition flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
                    activeSubject === sub
                      ? 'bg-white text-blue-700 border-b-2 border-b-blue-600 font-extrabold'
                      : 'text-gray-700 hover:bg-slate-200 hover:text-gray-900'
                  }`}
                >
                  {sub}
                  {activeSubject === sub && <Info className="w-3.5 h-3.5 text-blue-500" />}
                </button>
              ))}
            </div>

            {/* Live Timer Counter */}
            <div className="px-3 py-1.5 bg-white border border-gray-200 rounded shadow-xs text-xs font-mono text-red-600 font-bold flex items-center gap-1.5 self-end sm:self-center mr-1">
              <Clock className="w-3.5 h-3.5 animate-pulse" />
              <span>Time Left: {formatTime(timeLeft)}</span>
            </div>
          </div>

          {/* ACTIVE SECTION NAVIGATOR */}
          <div className="px-3 md:px-4 py-2 bg-white border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex gap-1.5 overflow-x-auto flex-nowrap py-0.5">
              {sectionTypes.map(type => (
                <button
                  key={type}
                  onClick={() => handleSectionTabClick(type)}
                  className={`px-4 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-lg border text-[10px] md:text-xs font-extrabold transition cursor-pointer whitespace-nowrap flex items-center justify-center ${
                    currentQuestion?.answerType === type
                      ? 'bg-blue-50 text-blue-700 border-blue-500 shadow-xs'
                      : 'border-gray-300 text-gray-700 hover:bg-slate-50'
                  }`}
                >
                  {getSectionLabel(type)}
                </button>
              ))}
            </div>

            {tabSwitchCount > 0 && (
              <span className="px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-800 font-bold flex items-center gap-1 animate-pulse self-start sm:self-center">
                <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                Compliance Warning: {tabSwitchCount} tab shifts
              </span>
            )}
          </div>

          {/* QUESTION HEADER INFORMATION */}
          <div className="px-5 py-2.5 border-b border-gray-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-700">
            <div className="flex items-center gap-3">
              <span className="font-extrabold text-sm text-gray-900">
                Question No: {currentSubjectIndex}
              </span>
              <span className="h-4 w-px bg-gray-300" />
              <span className="text-gray-500">
                Type: <span className="font-semibold text-gray-800 uppercase">{currentQuestion?.answerType === 'mcq' ? 'Multiple Choice (Single)' : currentQuestion?.answerType === 'numerical' ? 'Numeric Value NAT' : 'Subjective Description'}</span>
              </span>
            </div>

            {/* Text scaling & Marks panel */}
            <div className="flex items-center gap-4">
              {/* Text Size Scale Toggle */}
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md px-1.5 py-0.5">
                <span className="text-[10px] text-gray-400 font-bold mr-1">Text Size:</span>
                <button
                  onClick={handleDecreaseTextSize}
                  className="px-1.5 py-0.5 hover:bg-slate-100 rounded text-[10px] font-black text-gray-600 transition"
                  title="Decrease Font Size"
                >
                  A-
                </button>
                <button
                  onClick={handleIncreaseTextSize}
                  className="px-1.5 py-0.5 hover:bg-slate-100 rounded text-[10px] font-black text-gray-600 transition"
                  title="Increase Font Size"
                >
                  A+
                </button>
              </div>

              {/* Marks indicators */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400 font-bold">Marks:</span>
                <span className="px-2 py-0.5 bg-green-100 border border-green-200 rounded text-green-800 font-extrabold text-[11px]" title="Correct Answer">
                  +{activeQuestionMarks.pos}
                </span>
                <span className="px-2 py-0.5 bg-red-100 border border-red-200 rounded text-red-800 font-extrabold text-[11px]" title="Incorrect Penalty">
                  -{activeQuestionMarks.neg}
                </span>
              </div>
            </div>
          </div>

          {/* ACTIVE QUESTION PANEL BODY */}
          <div className="flex-1 p-4 md:p-6 pb-28 lg:pb-6 overflow-y-auto space-y-6 bg-white" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
            <div className={`prose max-w-none text-black font-black leading-relaxed ${getTextSizeClass()}`} id="active-question-body-wrapper">
              {currentQuestion ? (
                <LatexRenderer text={currentQuestion.body} className="text-black font-bold select-text font-sans" />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500 space-y-2">
                  <FileText className="w-12 h-12 stroke-1" />
                  <span>No active question selected in current subject</span>
                </div>
              )}
            </div>

            {/* Candidate Option Input Area */}
            {currentQuestion && (
              <div className="border-t border-gray-200 pt-6">
                
                {/* MCQ (Single-Select Radio Options) */}
                {currentQuestion.answerType === 'mcq' && (
                  <div className="space-y-3">
                    {currentQuestion.options.map((opt, oIdx) => {
                      const isSelected = responses[currentQuestion.id]?.answer === opt.id;
                      return (
                        <label
                          key={oIdx}
                          className={`flex items-start gap-3 p-3 md:p-4 border rounded-xl cursor-pointer transition-all duration-150 select-none ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600 text-black shadow-xs'
                              : 'border-gray-300 hover:border-gray-400 hover:bg-slate-50 bg-white text-black'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q-${currentQuestion.id}`}
                            value={opt.id}
                            checked={isSelected}
                            onChange={() => handleAnswerChange(opt.id)}
                            className="sr-only"
                          />
                          
                          {/* Custom Styled High-Contrast Radio Indicator */}
                          <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white scale-105 shadow-sm'
                              : 'border-gray-400 hover:border-gray-600 bg-white'
                          }`}>
                            {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>

                          <div className={`flex items-start ${getTextSizeClass()} text-black`}>
                            <span className="font-black text-black mr-2.5 text-sm md:text-base">{String.fromCharCode(65 + oIdx)}.</span>
                            <div className="flex-1 text-black font-bold text-sm md:text-base">
                              <LatexRenderer text={opt.text} className="text-black select-text font-sans font-bold" />
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Numerical Input Filter Box */}
                {currentQuestion.answerType === 'numerical' && (
                  <div className="max-w-md space-y-3 bg-slate-50 p-4 rounded-xl border border-gray-200">
                    <label className="block text-xs font-extrabold text-black uppercase tracking-wide">
                      Enter Numeric Answer:
                    </label>
                    <input
                      type="text"
                      pattern="[0-9.-]*"
                      value={responses[currentQuestion.id]?.answer || ''}
                      onChange={(e) => handleAnswerChange(e.target.value)}
                      className="w-full font-mono text-base px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-black font-bold outline-none placeholder:text-gray-400 shadow-sm"
                      placeholder="Type your numeric value (e.g. 5, -12, or 3.14)"
                    />
                    <div className="text-[10px] text-gray-700 space-y-0.5 font-semibold">
                      <p>• Only integers and decimal values are allowed.</p>
                      <p>• Make sure to review signs and decimal roundings before saving.</p>
                    </div>
                  </div>
                )}

                {/* Subjective Description Area */}
                {currentQuestion.answerType === 'subjective' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-extrabold text-black uppercase tracking-wide">
                      Your Detailed Solution Explanation:
                    </label>
                    <textarea
                      value={responses[currentQuestion.id]?.answer || ''}
                      onChange={(e) => handleAnswerChange(e.target.value)}
                      className="w-full text-sm p-4 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-black font-semibold outline-none h-40 resize-none shadow-sm placeholder:text-gray-400"
                      placeholder="Type your complete solution formulas or descriptions. This will be compared side-by-side with the model answer during post-exam review."
                    />
                  </div>
                )}

              </div>
            )}
          </div>

          {/* ACTION BUTTON BAR (JEE Exact) */}
          <div className="fixed bottom-0 left-0 right-0 z-30 bg-slate-50 border-t border-gray-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-lg lg:relative lg:shadow-none lg:border-t lg:p-3.5 lg:z-auto">
            <div className="grid grid-cols-3 sm:flex gap-2 w-full sm:w-auto">
              <button
                onClick={handleMarkForReviewAndNext}
                className="px-2 md:px-4 py-3 border border-purple-300 text-purple-800 bg-purple-50 hover:bg-purple-100 text-[11px] md:text-xs font-extrabold rounded-lg shadow-xs transition duration-150 cursor-pointer text-center flex items-center justify-center min-h-[44px]"
              >
                Mark Review
              </button>
              <button
                onClick={handleClearResponse}
                className="px-2 md:px-4 py-3 border border-gray-300 text-gray-800 bg-white hover:bg-gray-100 text-[11px] md:text-xs font-extrabold rounded-lg shadow-xs transition duration-150 cursor-pointer text-center flex items-center justify-center min-h-[44px]"
              >
                Clear Response
              </button>
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="flex lg:hidden px-2 py-3 border border-blue-300 text-blue-800 bg-blue-50 hover:bg-blue-100 text-[11px] md:text-xs font-extrabold rounded-lg shadow-xs transition duration-150 cursor-pointer items-center justify-center gap-1 min-h-[44px]"
              >
                <Grid className="w-3.5 h-3.5" />
                Palette
              </button>
            </div>

            <button
              onClick={handleSaveAndNext}
              className="w-full sm:w-auto px-6 py-3 bg-[#1e3a8a] hover:bg-[#172554] text-white text-xs font-black rounded-lg shadow hover:shadow-md transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
            >
              Save & Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* TOGGLE DIVIDER GRIP HANDLE */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 z-40 w-5 h-14 bg-slate-800 text-white rounded-l items-center justify-center cursor-pointer hover:bg-slate-700 border-l border-y border-slate-600 transition-all duration-200 ${
              isSidebarOpen ? 'right-[288px] lg:right-0' : 'right-0'
            }`}
            title={isSidebarOpen ? "Collapse Navigation Sidebar" : "Expand Navigation Sidebar"}
          >
            {isSidebarOpen ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* MOBILE SIDEBAR BACKDROP */}
        {isSidebarOpen && (
          <div 
            onClick={() => setIsSidebarOpen(false)}
            className="block lg:hidden absolute inset-0 bg-black/50 z-35 transition-opacity duration-200 cursor-pointer"
          />
        )}

        {/* RIGHT COLUMN: COLLAPSIBLE PALETTE PANEL / MOBILE BOTTOM SHEET */}
        <div className={`fixed bottom-0 left-0 right-0 h-[65vh] bg-[#e1e9f2] border-t border-gray-300 rounded-t-2xl p-4 space-y-4 z-40 shadow-2xl transition-transform duration-300 ease-in-out overflow-y-auto lg:relative lg:bottom-auto lg:left-auto lg:right-auto lg:h-auto lg:w-72 lg:flex-shrink-0 lg:flex lg:flex-col lg:border-l lg:rounded-none lg:shadow-none lg:translate-y-0 ${
          isSidebarOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0 lg:hidden'
        }`}>
          
          {/* Mobile bottom sheet drag handle */}
          <div className="flex lg:hidden items-center justify-center pb-2 cursor-pointer" onClick={() => setIsSidebarOpen(false)}>
            <div className="w-12 h-1.5 bg-gray-400/60 rounded-full" />
          </div>

          {/* Candidate Identity Card */}
          <div className="bg-white p-3 rounded-md shadow-xs border border-gray-200 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-slate-100 border border-gray-200 flex items-center justify-center text-gray-400">
              <User className="w-6 h-6 stroke-1.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-800 truncate leading-tight">{candidateName}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Attempt: <span className="text-blue-600 font-semibold uppercase">JEE-CBT-1</span></p>
            </div>
          </div>

          {/* Shape Legend Panel */}
          <div className="bg-white p-3 border border-gray-200 rounded-md shadow-xs space-y-2.5">
            <h4 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-1">
              Response Summary
            </h4>

            <div className="grid grid-cols-2 gap-x-2 gap-y-2.5">
              {/* Answered */}
              <div className="flex items-center gap-2">
                <JeeShapeIcon type="ANSWERED" text={String(getActiveSectionStats().answered)} size="w-7 h-7" />
                <span className="text-[10px] font-bold text-gray-700 leading-tight">Answered</span>
              </div>

              {/* Not Answered */}
              <div className="flex items-center gap-2">
                <JeeShapeIcon type="NOT_ANSWERED" text={String(getActiveSectionStats().notAnswered)} size="w-7 h-7" />
                <span className="text-[10px] font-bold text-gray-700 leading-tight">Not Answered</span>
              </div>

              {/* Not Visited */}
              <div className="flex items-center gap-2">
                <JeeShapeIcon type="NOT_VISITED" text={String(getActiveSectionStats().notVisited)} size="w-7 h-7" />
                <span className="text-[10px] font-bold text-gray-700 leading-tight">Not Visited</span>
              </div>

              {/* Marked for Review */}
              <div className="flex items-center gap-2">
                <JeeShapeIcon type="MARKED_FOR_REVIEW" text={String(getActiveSectionStats().marked)} size="w-7 h-7" />
                <span className="text-[10px] font-bold text-gray-700 leading-tight">Marked</span>
              </div>
            </div>

            {/* Answered & Marked for Review */}
            <div className="flex items-start gap-2 pt-1.5 border-t border-gray-100">
              <JeeShapeIcon type="ANSWERED_AND_MARKED_FOR_REVIEW" text={String(getActiveSectionStats().answeredMarked)} size="w-7 h-7" />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-gray-700 leading-tight block">Ans & Marked</span>
                <span className="text-[8px] text-gray-400 block leading-none mt-0.5">(evaluation active)</span>
              </div>
            </div>
          </div>

          {/* Subject Division Header */}
          <div className="bg-[#1e3a8a] text-white px-3 py-1.5 rounded-sm text-xs font-extrabold uppercase tracking-wider shadow-sm flex items-center justify-between">
            <span>{activeSubject}</span>
            <span className="text-[10px] text-blue-200">Palette</span>
          </div>

          {/* Shape Grid Navigation Palette */}
          <div className="flex-1 overflow-y-auto bg-white p-3 border border-gray-200 rounded-md shadow-xs max-h-[280px]">
            <div className="grid grid-cols-5 gap-2">
              {activeSubjectQuestions.map((q, qIdx) => {
                const state = (responses[q.id]?.state as any) || 'NOT_VISITED';
                const isCurrent = q.id === currentQuestionId;
                return (
                  <button
                    key={q.id}
                    onClick={() => handleVisitQuestion(q.id)}
                    className={`relative aspect-square transition duration-150 transform active:scale-95 cursor-pointer outline-none rounded-sm ${
                      isCurrent ? 'ring-2 ring-blue-600 ring-offset-2 z-10 scale-105 shadow-md' : 'hover:opacity-90'
                    }`}
                  >
                    <JeeShapeIcon
                      type={state}
                      text={String(qIdx + 1)}
                      size="w-full h-full"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sidebar bottom action (Submit Test) */}
          <div className="pt-2">
            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded shadow hover:shadow-md transition uppercase tracking-wider cursor-pointer text-center"
            >
              Submit Examination
            </button>
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
                className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold text-xs rounded-lg transition cursor-pointer"
              >
                Go Back to Exam
              </button>
              <button
                onClick={handleConfirmSubmit}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-lg shadow transition cursor-pointer"
              >
                Confirm Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUESTION PAPER PORTAL OVERLAY MODAL */}
      {isQuestionPaperModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none animate-fade-in" id="question-paper-modal">
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center rounded-t-xl">
              <h3 className="text-sm font-extrabold flex items-center gap-2">
                <FileText className="w-4 h-4 text-yellow-400" />
                Active Test Question Paper: <span className="text-yellow-400">{test.name}</span>
              </h3>
              <button
                onClick={() => setIsQuestionPaperModalOpen(false)}
                className="p-1 hover:bg-slate-800 rounded transition text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50">
              {subjects.map(sub => {
                const qList = questionsBySubject[sub] || [];
                return (
                  <div key={sub} className="space-y-4">
                    <h4 className="text-xs font-bold text-blue-700 bg-blue-50 border-b border-blue-200 px-3 py-1 rounded uppercase tracking-wider">
                      {sub} ({qList.length} Questions)
                    </h4>
                    <div className="space-y-6 divide-y divide-gray-200">
                      {qList.map((q, idx) => (
                        <div key={q.id} className="pt-4 first:pt-0 space-y-3">
                          <div className="flex items-center justify-between text-xs font-bold text-gray-500">
                            <span>Question {idx + 1} (ID: {q.id})</span>
                            <span className="uppercase text-[10px] tracking-wider px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
                              {q.answerType}
                            </span>
                          </div>
                          <div className="prose prose-sm max-w-none text-gray-850">
                            <LatexRenderer text={q.body} />
                          </div>
                          {q.answerType === 'mcq' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              {q.options.map((opt, oIdx) => (
                                <div key={oIdx} className="p-2 border border-gray-200 bg-white rounded flex gap-2">
                                  <span className="font-bold text-gray-500">{String.fromCharCode(65 + oIdx)}.</span>
                                  <LatexRenderer text={opt.text} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="p-4 bg-slate-100 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setIsQuestionPaperModalOpen(false)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow transition cursor-pointer"
              >
                Close Question Paper
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GENERAL INSTRUCTIONS REFERENCE OVERLAY MODAL */}
      {isInstructionsModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none animate-fade-in" id="instructions-modal">
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center rounded-t-xl">
              <h3 className="text-sm font-extrabold flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-400" />
                General Instructions Reference
              </h3>
              <button
                onClick={() => setIsInstructionsModalOpen(false)}
                className="p-1 hover:bg-slate-800 rounded transition text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-gray-600 leading-relaxed">
              <p className="font-bold text-gray-800">Please read the instructions carefully:</p>
              <ol className="list-decimal pl-5 space-y-2.5">
                <li>
                  <span className="font-semibold text-gray-800">Total Duration:</span> Total duration of this examination is 3 hours (180 minutes).
                </li>
                <li>
                  The server clock is started automatically. The countdown timer in the top-right of your screen indicates the remaining time. When the timer hits zero, the exam commits an <span className="font-bold text-blue-600">automatic submission</span>.
                </li>
                <li>
                  The status of questions in the Question Palette on the right displays:
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div className="flex items-center gap-2">
                      <JeeShapeIcon type="NOT_VISITED" text="1" size="w-7 h-7" />
                      <span>Not Visited (Grey Square)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <JeeShapeIcon type="NOT_ANSWERED" text="2" size="w-7 h-7" />
                      <span>Not Answered (Red Pentagon Down)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <JeeShapeIcon type="ANSWERED" text="3" size="w-7 h-7" />
                      <span>Answered (Green Pentagon Up)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <JeeShapeIcon type="MARKED_FOR_REVIEW" text="4" size="w-7 h-7" />
                      <span>Marked for Review (Purple Circle)</span>
                    </div>
                    <div className="flex items-center gap-2 md:col-span-2">
                      <JeeShapeIcon type="ANSWERED_AND_MARKED_FOR_REVIEW" text="5" size="w-7 h-7" />
                      <span>Answered & Marked for Review (will be considered for evaluation)</span>
                    </div>
                  </div>
                </li>
                <li>
                  <span className="font-bold text-gray-800">Action Keys:</span>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li><span className="font-semibold">Save & Next:</span> Confirms response and moves to the next question.</li>
                    <li><span className="font-semibold">Clear Response:</span> Resets answer field for active question.</li>
                    <li><span className="font-semibold">Mark for Review & Next:</span> Marks the response and moves forward.</li>
                  </ul>
                </li>
                <li>
                  <span className="font-bold text-yellow-600">Compliance Blocker:</span> Avoid switching tabs or closing browser window to prevent security logs and suspension warnings.
                </li>
              </ol>
            </div>
            
            <div className="p-4 bg-slate-100 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setIsInstructionsModalOpen(false)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow transition cursor-pointer"
              >
                Close Instructions
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CbtExamEngine;
