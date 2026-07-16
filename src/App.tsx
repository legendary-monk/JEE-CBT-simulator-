/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Test, Attempt, MarkingScheme } from './types';
import { 
  getAllTests, 
  getAllAttempts, 
  saveTest, 
  deleteTest, 
  deleteAttempt, 
  exportDatabaseState, 
  importDatabaseState 
} from './db';
import { parseTexFile } from './parser';
import { SAMPLE_TEX_CONTENT } from './data/sampleTex';

// Components
import { UploadManager } from './components/UploadManager';
import { CbtExamEngine } from './components/CbtExamEngine';
import { AttemptReview } from './components/AttemptReview';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';

// Lucide Icons
import { 
  Trophy, 
  FileText, 
  Settings, 
  Sparkles, 
  Download, 
  Upload as UploadIcon, 
  HelpCircle,
  LayoutDashboard,
  Menu,
  X
} from 'lucide-react';

export default function App() {
  const [tests, setTests] = useState<Test[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [activeTab, setActiveTab] = useState<'arena' | 'analytics'>('arena');
  const [isLoading, setIsLoading] = useState(true);

  // Active Modes
  const [activeAttempt, setActiveAttempt] = useState<Attempt | null>(null);
  const [activeReviewAttempt, setActiveReviewAttempt] = useState<Attempt | null>(null);
  
  // Selection fields for starting test
  const [examTest, setExamTest] = useState<Test | null>(null);
  const [examScheme, setExamScheme] = useState<MarkingScheme | null>(null);
  const [examCandidateName, setExamCandidateName] = useState('');

  // Notifications
  const [notify, setNotify] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-seed default test on start if DB empty
  useEffect(() => {
    async function loadData() {
      try {
        let loadedTests = await getAllTests();
        let loadedAttempts = await getAllAttempts();

        if (loadedTests.length === 0) {
          const { questions } = parseTexFile(SAMPLE_TEX_CONTENT);
          if (questions.length > 0) {
            const demoTest: Test = {
              id: 'demo-jee-test-1',
              name: 'Sample JEE Full Mock',
              questions,
              createdAt: Date.now()
            };
            await saveTest(demoTest);
            loadedTests = [demoTest];
          }
        }

        setTests(loadedTests);
        setAttempts(loadedAttempts);
        
        // Resume in-progress attempt if available
        const inProgress = loadedAttempts.find(a => !a.isSubmitted);
        if (inProgress) {
          const matchedTest = loadedTests.find(t => t.id === inProgress.testId);
          if (matchedTest) {
            setExamTest(matchedTest);
            setExamScheme(inProgress.markingScheme);
            setExamCandidateName(inProgress.candidateName);
            setActiveAttempt(inProgress);
            showNotification('success', `Resumed in-progress test for ${inProgress.candidateName}!`);
          }
        }

      } catch (err) {
        console.error("IndexedDB startup error", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotify({ type, message });
    setTimeout(() => setNotify(null), 4000);
  };

  // Reload lists from DB
  const refreshState = async () => {
    const t = await getAllTests();
    const a = await getAllAttempts();
    setTests(t);
    setAttempts(a);
  };

  // Handlers
  const handleTestLoaded = async (newTest: Test, scheme: MarkingScheme, candidateName: string) => {
    await saveTest(newTest);
    setExamTest(newTest);
    setExamScheme(scheme);
    setExamCandidateName(candidateName);
    
    // Trigger fresh attempt structure
    setActiveAttempt(null); // start fresh
    setActiveTab('arena');
    await refreshState();
  };

  const handleSelectExistingTest = (selectedTest: Test, scheme: MarkingScheme, candidateName: string) => {
    setExamTest(selectedTest);
    setExamScheme(scheme);
    setExamCandidateName(candidateName);
    setActiveAttempt(null); // fresh simulation
  };

  const handleDeleteTest = async (testId: string) => {
    if (confirm("Are you sure you want to delete this test? All associated candidate attempts will also be deleted from IndexedDB.")) {
      await deleteTest(testId);
      await refreshState();
      showNotification('success', 'Test paper deleted successfully.');
    }
  };

  const handleDeleteAttempt = async (attemptId: string) => {
    if (confirm("Are you sure you want to delete this attempt record from your dashboard history?")) {
      await deleteAttempt(attemptId);
      await refreshState();
      showNotification('success', 'Exam attempt deleted successfully.');
    }
  };

  const handleExamSubmitted = async (finishedAttempt: Attempt) => {
    await refreshState();
    setActiveAttempt(null);
    setExamTest(null);
    setExamScheme(null);
    
    // Jump straight to reviewing this submission
    setActiveReviewAttempt(finishedAttempt);
    showNotification('success', 'Exam submitted successfully! Self-assess subjective answers now.');
  };

  // Database Backup / Restore
  const handleExportBackup = async () => {
    try {
      const dataStr = await exportDatabaseState();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `JEE_CBT_Portal_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotification('success', 'Local database backup exported successfully!');
    } catch (err) {
      showNotification('error', 'Failed to export backup.');
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        const res = await importDatabaseState(text);
        if (res.success) {
          await refreshState();
          showNotification('success', 'All tests and candidate attempts successfully imported!');
        } else {
          showNotification('error', `Import failed: ${res.error}`);
        }
      };
      reader.readAsText(file);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-400">Initializing Local Database Engine...</p>
        </div>
      </div>
    );
  }

  // Render Fullscreen CBT Exam Area (Hides main layout navigation)
  if (examTest && examScheme && examCandidateName && !activeReviewAttempt) {
    return (
      <div className="min-h-screen bg-slate-100 p-3 md:p-6 flex flex-col justify-center items-center">
        <div className="w-full max-w-7xl">
          <CbtExamEngine
            test={examTest}
            markingScheme={examScheme}
            candidateName={examCandidateName}
            resumeAttempt={activeAttempt}
            onExamSubmitted={handleExamSubmitted}
            onExit={() => {
              if (confirm("Are you sure you want to pause this exam and exit to dashboard? Your in-progress timer and response sheet will remain preserved in IndexedDB.")) {
                setExamTest(null);
                setExamScheme(null);
                refreshState();
              }
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col" id="app-portal-wrapper">
      
      {/* Persistent App Header Navigation */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Logo Group */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setActiveReviewAttempt(null); setActiveTab('arena'); }}>
              <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-black text-white tracking-tight leading-none flex items-center gap-1.5">
                  JEE CBT Simulator
                </h1>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">
                  NTA CBT Replica Portal
                </span>
              </div>
            </div>

            {/* Menu Tabs */}
            {!activeReviewAttempt && (
              <nav className="flex space-x-1">
                <button
                  onClick={() => { setActiveTab('arena'); }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                    activeTab === 'arena'
                      ? 'bg-blue-950/60 text-blue-400 border border-blue-900/30'
                      : 'text-slate-400 hover:bg-slate-850 hover:text-white'
                  }`}
                >
                  CBT Practice Arena
                </button>
                <button
                  onClick={() => { setActiveTab('analytics'); }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                    activeTab === 'analytics'
                      ? 'bg-blue-950/60 text-blue-400 border border-blue-900/30'
                      : 'text-slate-400 hover:bg-slate-850 hover:text-white'
                  }`}
                >
                  Dashboard & Analytics ({attempts.length})
                </button>
              </nav>
            )}

            {/* Actions Panel */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportBackup}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                title="Export database state (JSON)"
              >
                <Download className="w-4 h-4" />
              </button>
              <label
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                title="Import database state (JSON)"
              >
                <UploadIcon className="w-4 h-4" />
                <input
                  type="file"
                  onChange={handleImportBackup}
                  accept=".json"
                  className="hidden"
                />
              </label>
            </div>

          </div>
        </div>
      </header>

      {/* Notifications Portal */}
      {notify && (
        <div className="fixed top-20 right-6 z-50 animate-fade-in">
          <div className={`p-4 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2.5 ${
            notify.type === 'success' 
              ? 'bg-green-950/80 border-green-900/40 text-green-400' 
              : 'bg-red-950/80 border-red-900/40 text-red-400'
          }`}>
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            <span>{notify.message}</span>
          </div>
        </div>
      )}

      {/* Main Content Render */}
      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          
          {activeReviewAttempt ? (
            /* Solution Review View */
            <AttemptReview
              attempt={activeReviewAttempt}
              testQuestions={
                tests.find(t => t.id === activeReviewAttempt.testId)?.questions || []
              }
              onReviewUpdated={(updated) => {
                setActiveReviewAttempt(updated);
                refreshState();
              }}
              onClose={() => {
                setActiveReviewAttempt(null);
                setActiveTab('analytics');
              }}
            />
          ) : (
            /* Active Mode views */
            <>
              {activeTab === 'arena' && (
                <UploadManager
                  onTestLoaded={handleTestLoaded}
                  existingTests={tests}
                  onSelectExistingTest={handleSelectExistingTest}
                  onDeleteTest={handleDeleteTest}
                />
              )}

              {activeTab === 'analytics' && (
                <AnalyticsDashboard
                  attempts={attempts}
                  tests={tests}
                  onReviewAttempt={(att) => {
                    setActiveReviewAttempt(att);
                  }}
                  onDeleteAttempt={handleDeleteAttempt}
                  onLaunchPractice={() => {
                    setActiveTab('arena');
                  }}
                />
              )}
            </>
          )}

        </div>
      </main>

      {/* Humble aesthetic footer */}
      <footer className="bg-slate-900 border-t border-slate-850 py-6 text-center text-xs text-slate-500 select-none">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p>© 2026 JEE CBT Practice Portal. Implemented fully in client-side TypeScript.</p>
          <p className="mt-1 text-[10px] text-slate-600">All student logs remain fully sandboxed and stored inside your secure local browser sandbox.</p>
        </div>
      </footer>

    </div>
  );
}
