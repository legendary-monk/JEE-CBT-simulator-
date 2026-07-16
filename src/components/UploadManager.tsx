/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { parseTexFile } from '../parser';
import { Test, MarkingScheme } from '../types';
import { SAMPLE_TEX_CONTENT } from '../data/sampleTex';
import { Upload, AlertCircle, Sparkles, BookOpen, FileCode, CheckCircle, HelpCircle } from 'lucide-react';

interface UploadManagerProps {
  onTestLoaded: (test: Test, markingScheme: MarkingScheme, candidateName: string) => void;
  existingTests: Test[];
  onSelectExistingTest: (test: Test, markingScheme: MarkingScheme, candidateName: string) => void;
  onDeleteTest: (testId: string) => void;
}

export const UploadManager: React.FC<UploadManagerProps> = ({
  onTestLoaded,
  existingTests,
  onSelectExistingTest,
  onDeleteTest,
}) => {
  const [candidateName, setCandidateName] = useState('JEE Aspirant');
  const [testName, setTestName] = useState('JEE Mock Challenge');
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'existing'>('upload');
  const [pasteContent, setPasteContent] = useState('');
  
  // Marking Scheme states
  const [preset, setPreset] = useState<MarkingScheme['preset']>('jee-main');
  const [mcqPos, setMcqPos] = useState(4);
  const [mcqNeg, setMcqNeg] = useState(-1);
  const [numPos, setNumPos] = useState(4);
  const [numNeg, setNumNeg] = useState(-1);
  const [numNoNeg, setNumNoNeg] = useState(false); // JEE Main NAT no-negative variant
  const [subPos, setSubPos] = useState(4);
  const [subNeg, setSubNeg] = useState(0);

  const [errors, setErrors] = useState<string[]>([]);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [parsedQuestionsCount, setParsedQuestionsCount] = useState(0);
  const [currentParsedQuestions, setCurrentParsedQuestions] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  // Preset update triggers
  const handlePresetChange = (selectedPreset: MarkingScheme['preset']) => {
    setPreset(selectedPreset);
    if (selectedPreset === 'jee-main') {
      setMcqPos(4);
      setMcqNeg(-1);
      setNumPos(4);
      setNumNeg(-1);
      setNumNoNeg(false);
      setSubPos(4);
      setSubNeg(0);
    } else if (selectedPreset === 'jee-advanced') {
      setMcqPos(3);
      setMcqNeg(-1);
      setNumPos(3);
      setNumNeg(0);
      setNumNoNeg(true);
      setSubPos(3);
      setSubNeg(0);
    } else if (selectedPreset === 'no-negative') {
      setMcqPos(4);
      setMcqNeg(0);
      setNumPos(4);
      setNumNeg(0);
      setNumNoNeg(true);
      setSubPos(4);
      setSubNeg(0);
    }
  };

  const processContent = (text: string) => {
    setErrors([]);
    setSuccessInfo(null);
    const { questions, errors: parseErrors } = parseTexFile(text);

    if (parseErrors.length > 0) {
      setErrors(parseErrors);
      setCurrentParsedQuestions([]);
      setParsedQuestionsCount(0);
      return;
    }

    if (questions.length === 0) {
      setErrors(['No questions found inside file. Please ensure questions are inside \\begin{quizquestion} blocks.']);
      setCurrentParsedQuestions([]);
      return;
    }

    setCurrentParsedQuestions(questions);
    setParsedQuestionsCount(questions.length);
    setSuccessInfo(`Successfully validated ${questions.length} questions! Ready to proceed.`);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setTestName(file.name.replace(/\.[^/.]+$/, ""));
        processContent(text);
      };
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setTestName(file.name.replace(/\.[^/.]+$/, ""));
        processContent(text);
      };
      reader.readAsText(file);
    }
  };

  const loadSample = () => {
    setTestName('JEE Sample Mock Challenge');
    processContent(SAMPLE_TEX_CONTENT);
    setActiveTab('paste');
    setPasteContent(SAMPLE_TEX_CONTENT);
  };

  const handleStartExam = () => {
    if (currentParsedQuestions.length === 0) {
      setErrors(['Please load or paste a valid .tex file first.']);
      return;
    }

    if (!candidateName.trim()) {
      setErrors(['Please enter candidate name to track your analytics.']);
      return;
    }

    const test: Test = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      name: testName || 'JEE Practice Exam',
      questions: currentParsedQuestions,
      createdAt: Date.now()
    };

    const scheme: MarkingScheme = {
      preset,
      mcqPositive: Number(mcqPos),
      mcqNegative: Number(mcqNeg),
      numericalPositive: Number(numPos),
      numericalNegative: numNoNeg ? 0 : Number(numNeg),
      numericalNoNegative: numNoNeg,
      subjectivePositive: Number(subPos),
      subjectiveNegative: Number(subNeg)
    };

    onTestLoaded(test, scheme, candidateName);
  };

  const handleStartExistingExam = (test: Test) => {
    if (!candidateName.trim()) {
      setErrors(['Please enter candidate name to track your analytics.']);
      return;
    }

    const scheme: MarkingScheme = {
      preset,
      mcqPositive: Number(mcqPos),
      mcqNegative: Number(mcqNeg),
      numericalPositive: Number(numPos),
      numericalNegative: numNoNeg ? 0 : Number(numNeg),
      numericalNoNegative: numNoNeg,
      subjectivePositive: Number(subPos),
      subjectiveNegative: Number(subNeg)
    };

    onSelectExistingTest(test, scheme, candidateName);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 animate-fade-in" id="upload-manager-root">
      {/* Visual Identity Section */}
      <div className="text-center space-y-2">
        <span className="px-3 py-1 bg-blue-950/40 text-blue-400 text-xs font-semibold rounded-full border border-blue-900/40 uppercase tracking-wide">
          Standard NTA Interface Emulator
        </span>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">JEE Computer-Based Test (CBT) Portal</h1>
        <p className="text-slate-400 max-w-xl mx-auto text-sm">
          A fully client-side JEE simulator. Load custom <code>.tex</code> papers, configure specific marking rules, and measure calibration on real math.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Configuration Column (Left) */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              1. Candidate & Test Info
            </h2>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Candidate Name</label>
                <input
                  type="text"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-800 bg-slate-950 text-slate-100 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Test Name</label>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-800 bg-slate-950 text-slate-100 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="e.g. JEE Full Mock Paper"
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-400" />
              2. Marking Scheme
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Select Preset</label>
                <select
                  value={preset}
                  onChange={(e) => handlePresetChange(e.target.value as MarkingScheme['preset'])}
                  className="w-full text-sm px-3 py-2 border border-slate-800 rounded-md bg-slate-950 text-slate-100 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  <option value="jee-main">JEE Main (Standard)</option>
                  <option value="jee-advanced">Advanced (typical) — edit before use</option>
                  <option value="no-negative">No Negatives</option>
                  <option value="custom">Custom (Fully Editable)</option>
                </select>
              </div>

              {/* MCQ Marking */}
              <div className="border-t border-slate-800 pt-3 space-y-2">
                <span className="text-xs font-bold text-slate-200 block">MCQ Marking Scheme</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase">Correct</label>
                    <input
                      type="number"
                      value={mcqPos}
                      onChange={(e) => { setMcqPos(Number(e.target.value)); setPreset('custom'); }}
                      className="w-full text-xs px-2 py-1.5 border border-slate-800 bg-slate-950 text-slate-100 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase">Incorrect</label>
                    <input
                      type="number"
                      value={mcqNeg}
                      onChange={(e) => { setMcqNeg(Number(e.target.value)); setPreset('custom'); }}
                      className="w-full text-xs px-2 py-1.5 border border-slate-800 bg-slate-950 text-slate-100 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Numerical Marking */}
              <div className="border-t border-slate-800 pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-200">Numerical (NAT) Scheme</span>
                  <label className="flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={numNoNeg}
                      onChange={(e) => { setNumNoNeg(e.target.checked); setPreset('custom'); }}
                      className="w-3.5 h-3.5 rounded border-slate-800 text-blue-600 bg-slate-950 focus:ring-blue-500"
                    />
                    <span className="text-[10px] text-slate-400">No Negative</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase">Correct</label>
                    <input
                      type="number"
                      value={numPos}
                      onChange={(e) => { setNumPos(Number(e.target.value)); setPreset('custom'); }}
                      className="w-full text-xs px-2 py-1.5 border border-slate-800 bg-slate-950 text-slate-100 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase">Incorrect</label>
                    <input
                      type="number"
                      value={numNeg}
                      disabled={numNoNeg}
                      onChange={(e) => { setNumNeg(Number(e.target.value)); setPreset('custom'); }}
                      className="w-full text-xs px-2 py-1.5 border border-slate-800 bg-slate-950 text-slate-100 rounded focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-950 disabled:text-slate-600"
                    />
                  </div>
                </div>
              </div>

              {/* Subjective Scheme */}
              <div className="border-t border-slate-800 pt-3 space-y-2">
                <span className="text-xs font-bold text-slate-200 block">Subjective (Self-Marked) Scheme</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase">Correct</label>
                    <input
                      type="number"
                      value={subPos}
                      onChange={(e) => { setSubPos(Number(e.target.value)); setPreset('custom'); }}
                      className="w-full text-xs px-2 py-1.5 border border-slate-800 bg-slate-950 text-slate-100 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase">Incorrect</label>
                    <input
                      type="number"
                      value={subNeg}
                      onChange={(e) => { setSubNeg(Number(e.target.value)); setPreset('custom'); }}
                      className="w-full text-xs px-2 py-1.5 border border-slate-800 bg-slate-950 text-slate-100 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Content Portal Column (Right) */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-sm overflow-hidden flex flex-col h-[520px]">
            {/* Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/60">
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
                  activeTab === 'upload'
                    ? 'border-blue-500 text-blue-400 bg-slate-900/40'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
                }`}
              >
                <Upload className="w-4 h-4" />
                Upload .TeX File
              </button>
              <button
                onClick={() => setActiveTab('paste')}
                className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
                  activeTab === 'paste'
                    ? 'border-blue-500 text-blue-400 bg-slate-900/40'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
                }`}
              >
                <FileCode className="w-4 h-4" />
                Paste TeX Code
              </button>
              <button
                onClick={() => setActiveTab('existing')}
                className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
                  activeTab === 'existing'
                    ? 'border-blue-500 text-blue-400 bg-slate-900/40'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Available Tests ({existingTests.length})
              </button>
            </div>

            {/* Tab Panels */}
            <div className="p-6 flex-1 overflow-y-auto">
              {activeTab === 'upload' && (
                <div className="space-y-6 h-full flex flex-col justify-center">
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center flex-1 ${
                      isDragActive
                        ? 'border-blue-500 bg-blue-950/40'
                        : 'border-slate-800 hover:border-blue-500/40 hover:bg-slate-950/40'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".tex"
                      className="hidden"
                    />
                    <div className="p-4 bg-blue-950 text-blue-400 border border-blue-900/30 rounded-full mb-3">
                      <Upload className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-bold text-slate-200 mb-1">
                      Drag & Drop your JEE <code>.tex</code> paper here
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm">
                      Supports LaTeX tag-schemas containing <code>quizquestion</code>, maths structures, and answers.
                    </p>
                    <span className="mt-4 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition shadow-sm">
                      Select TeX File
                    </span>
                  </div>

                  <div className="text-center">
                    <span className="text-[10px] tracking-wider text-slate-600 block mb-2">— OR PLAY IMMEDIATELY —</span>
                    <button
                      onClick={loadSample}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      Load Practice Mock Test
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'paste' && (
                <div className="space-y-4 h-full flex flex-col">
                  <textarea
                    value={pasteContent}
                    onChange={(e) => {
                      setPasteContent(e.target.value);
                      processContent(e.target.value);
                    }}
                    className="w-full flex-1 border border-slate-800 bg-slate-950 text-slate-200 rounded-lg p-3 font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    placeholder={`% Paste your custom quiz questions in LaTeX here...
\\begin{quizquestion}{Q1}
  \\subject{Physics}
  \\topic{Mechanics}
  \\answertype{mcq}
  \\marks{4}
  
  What is the dimensions of force?
  
  \\option{$[M^1L^1T^{-2}]$}
  \\option{$[M^1L^2T^{-2}]$}
  \\option{$[M^1L^1T^{-1}]$}
  \\option{$[M^2L^1T^{-2}]$}
  
  \\correctoption{$[M^1L^1T^{-2}]$}
\\end{quizquestion}`}
                  />
                  <div className="flex justify-between items-center pt-2">
                    <button
                      onClick={loadSample}
                      className="text-xs text-blue-400 hover:underline font-semibold"
                    >
                      Reset to sample LaTeX template
                    </button>
                    <button
                      onClick={() => processContent(pasteContent)}
                      className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg"
                    >
                      Parse Input Now
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'existing' && (
                <div className="space-y-3 h-full">
                  {existingTests.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 flex flex-col items-center justify-center h-full">
                      <BookOpen className="w-12 h-12 text-slate-600 mb-2" />
                      <p className="text-sm">No imported tests found in your database.</p>
                      <p className="text-xs text-slate-600">Import or paste a paper to get started.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {existingTests.map((test) => (
                        <div
                          key={test.id}
                          className="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-800 rounded-lg hover:border-blue-500/50 transition"
                        >
                          <div>
                            <p className="font-bold text-slate-200 text-sm">{test.name}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {test.questions.length} questions • Created {new Date(test.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleStartExistingExam(test)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md shadow-sm transition"
                            >
                              Launch Exam
                            </button>
                            <button
                              onClick={() => onDeleteTest(test.id)}
                              className="px-3 py-1.5 border border-red-900/50 hover:border-red-500 text-red-400 hover:bg-red-950/20 text-xs font-semibold rounded-md transition"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Parser Results / Actions Bar */}
            <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-between items-center">
              <div>
                {successInfo && (
                  <div className="flex items-center gap-1.5 text-green-400 font-medium text-xs">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{successInfo}</span>
                  </div>
                )}
                {errors.length > 0 && (
                  <div className="flex items-start gap-1.5 text-red-400 text-xs">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div className="max-w-md max-h-12 overflow-y-auto font-mono text-red-300">
                      {errors[0]} {errors.length > 1 && `(+${errors.length - 1} more errors)`}
                    </div>
                  </div>
                )}
                {!successInfo && errors.length === 0 && (
                  <span className="text-xs text-slate-500">Please load a test to proceed.</span>
                )}
              </div>

              {activeTab !== 'existing' && (
                <button
                  disabled={parsedQuestionsCount === 0}
                  onClick={handleStartExam}
                  className={`px-6 py-2.5 rounded-lg text-sm font-bold shadow transition select-none ${
                    parsedQuestionsCount > 0
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer hover:shadow-md'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Start Emulated CBT
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default UploadManager;
