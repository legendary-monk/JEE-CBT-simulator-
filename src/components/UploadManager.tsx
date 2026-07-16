/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo } from 'react';
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

const quotes = [
  { text: "I would rather have questions that can't be answered than answers that can't be questioned.", author: "Richard Feynman" },
  { text: "Nothing in life is to be feared, it is only to be understood.", author: "Marie Curie" },
  { text: "An equation has no meaning for me unless it expresses a thought of God.", author: "Srinivasa Ramanujan" },
  { text: "If I have seen further, it is by standing on the shoulders of giants.", author: "Isaac Newton" },
  { text: "Ask the right questions, and nature will open the doors to her secrets.", author: "C.V. Raman" },
  { text: "You have power over your mind, not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" },
  { text: "Difficulties strengthen the mind, as labor does the body.", author: "Seneca" },
  { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "Nothing is too wonderful to be true if it be consistent with the laws of nature.", author: "Michael Faraday" },
  { text: "Dream is not that which you see while sleeping, it is something that does not let you sleep.", author: "A.P.J. Abdul Kalam" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
  { text: "Mathematics is the queen of sciences.", author: "Carl Friedrich Gauss" },
  { text: "Measure what is measurable, and make measurable what is not so.", author: "Galileo Galilei" },
  { text: "It is not what happens to you, but how you react to it that matters.", author: "Epictetus" }
];

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

  // Generate a consistent Ticket ID and Quote per mount session
  const ticketId = useMemo(() => {
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `TKT-${rand}-JEE`;
  }, []);

  const selectedQuote = useMemo(() => {
    return quotes[Math.floor(Math.random() * quotes.length)];
  }, []);

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
      setErrors(['Please load or paste a valid .tex or .latex file first.']);
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pb-12 animate-fade-in" id="upload-manager-root">
      {/* Visual Identity Section */}
      <div className="text-center space-y-2">
        <span className="inline-block px-3 py-1 bg-graphite text-instrument-steel text-[10px] font-mono font-bold rounded border border-instrument-steel/20 uppercase tracking-wider">
          Standard NTA Interface Emulator
        </span>
        <h1 className="text-3xl font-serif font-bold text-chalk-white tracking-tight">
          JEE Computer-Based Test (CBT) Portal
        </h1>
        <p className="text-instrument-steel max-w-xl mx-auto text-sm leading-relaxed">
          A fully client-side JEE simulator. Load custom <code className="font-mono text-xs text-circuit-amber">.tex</code> or <code className="font-mono text-xs text-circuit-amber">.latex</code> papers, configure specific marking rules, and measure calibration on real math.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Column (Left) */}
        <div className="lg:col-span-1 space-y-6">
          {/* Hall Ticket Card Motif */}
          <div className="bg-graphite rounded-xl border border-instrument-steel/30 p-5 shadow-sm space-y-5 relative overflow-hidden">
            
            {/* Notch Cutouts & Perforation */}
            <div className="absolute top-[68%] left-0 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-blueprint-bg rounded-full border-r border-instrument-steel/30" />
            <div className="absolute top-[68%] right-0 -translate-y-1/2 translate-x-1/2 w-4 h-4 bg-blueprint-bg rounded-full border-l border-instrument-steel/30" />
            
            {/* Top section: Ticket Header */}
            <div className="space-y-4">
              <div className="flex justify-between items-start border-b border-instrument-steel/10 pb-3">
                <div>
                  <h2 className="text-xs font-mono font-bold text-circuit-amber tracking-wider uppercase">
                    HALL TICKET
                  </h2>
                  <p className="text-[10px] font-mono text-instrument-steel uppercase mt-0.5">
                    JEE PRACTICE SIMULATION
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-blueprint-bg text-instrument-steel border border-instrument-steel/10 rounded">
                    ADM-2026
                  </span>
                </div>
              </div>

              {/* Admit card fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-instrument-steel uppercase tracking-wider">
                    CANDIDATE NAME
                  </label>
                  <input
                    type="text"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    className="w-full text-base font-serif font-medium px-2 py-1 bg-blueprint-bg/40 border-b border-instrument-steel/30 text-chalk-white focus:border-circuit-amber outline-none transition duration-150 mt-1"
                    placeholder="Enter candidate name"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-instrument-steel uppercase tracking-wider">
                    EXAM / PAPER TITLE
                  </label>
                  <input
                    type="text"
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    className="w-full text-base font-serif font-medium px-2 py-1 bg-blueprint-bg/40 border-b border-instrument-steel/30 text-chalk-white focus:border-circuit-amber outline-none transition duration-150 mt-1"
                    placeholder="e.g. JEE Full Mock Paper"
                  />
                </div>
              </div>
            </div>

            {/* Perforated separator */}
            <div className="border-t border-dashed border-instrument-steel/30 -mx-5 pt-4 mt-4" />

            {/* Bottom Section: Ticket stub metadata */}
            <div className="space-y-2 pt-1 font-mono text-[10px] text-instrument-steel leading-relaxed">
              <div className="flex justify-between">
                <span>ROLL NUMBER:</span>
                <span className="text-chalk-white">2604-CBT-JEE</span>
              </div>
              <div className="flex justify-between">
                <span>CENTER ID:</span>
                <span className="text-chalk-white">BROWSER_SANDBOX</span>
              </div>
              <div className="flex justify-between">
                <span>TICKET CODE:</span>
                <span className="text-circuit-amber font-bold">{ticketId}</span>
              </div>
            </div>
          </div>

          {/* Engraved plate style quote */}
          <div className="bg-graphite/40 border border-instrument-steel/20 rounded-xl p-4 text-center relative overflow-hidden select-none">
            {/* Little corner screws or accents to look like an engraved plate */}
            <div className="absolute top-1.5 left-1.5 w-1 h-1 bg-instrument-steel/40 rounded-full" />
            <div className="absolute top-1.5 right-1.5 w-1 h-1 bg-instrument-steel/40 rounded-full" />
            <div className="absolute bottom-1.5 left-1.5 w-1 h-1 bg-instrument-steel/40 rounded-full" />
            <div className="absolute bottom-1.5 right-1.5 w-1 h-1 bg-instrument-steel/40 rounded-full" />
            
            <p className="font-serif italic text-xs text-instrument-steel px-2 leading-relaxed">
              "{selectedQuote.text}"
            </p>
            <p className="font-mono text-[9px] text-instrument-steel/70 mt-2 uppercase tracking-widest">
              — {selectedQuote.author}
            </p>
          </div>

          {/* Marking Scheme */}
          <div className="bg-graphite rounded-xl border border-instrument-steel/20 p-5 shadow-sm space-y-4">
            <h2 className="text-base font-serif font-bold text-chalk-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-circuit-amber" />
              Marking Scheme
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-bold text-instrument-steel uppercase tracking-wider mb-1.5">Select Preset</label>
                <select
                  value={preset}
                  onChange={(e) => handlePresetChange(e.target.value as MarkingScheme['preset'])}
                  className="w-full text-sm font-mono px-3 py-2 border border-instrument-steel/30 rounded bg-blueprint-bg text-chalk-white focus:border-circuit-amber outline-none transition duration-150 cursor-pointer"
                >
                  <option value="jee-main">JEE Main (Standard)</option>
                  <option value="jee-advanced">Advanced (typical)</option>
                  <option value="no-negative">No Negatives</option>
                  <option value="custom">Custom (Fully Editable)</option>
                </select>
              </div>

              {/* MCQ Marking */}
              <div className="border-t border-instrument-steel/10 pt-3.5 space-y-2">
                <span className="text-xs font-mono font-bold text-chalk-white block">MCQ Single Choice</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-mono font-bold text-instrument-steel uppercase tracking-wider">Correct</label>
                    <input
                      type="number"
                      value={mcqPos}
                      onChange={(e) => { setMcqPos(Number(e.target.value)); setPreset('custom'); }}
                      className="w-full text-xs font-mono px-2.5 py-1.5 border border-instrument-steel/30 bg-blueprint-bg text-chalk-white rounded focus:border-circuit-amber outline-none transition duration-150"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono font-bold text-instrument-steel uppercase tracking-wider">Deducted per wrong answer</label>
                    <input
                      type="number"
                      value={mcqNeg}
                      onChange={(e) => { 
                        const val = Number(e.target.value); 
                        setMcqNeg(val === 0 ? 0 : -Math.abs(val)); 
                        setPreset('custom'); 
                      }}
                      className="w-full text-xs font-mono px-2.5 py-1.5 border border-instrument-steel/30 bg-blueprint-bg text-chalk-white rounded focus:border-circuit-amber outline-none transition duration-150"
                    />
                  </div>
                </div>
              </div>

              {/* Numerical Marking */}
              <div className="border-t border-instrument-steel/10 pt-3.5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono font-bold text-chalk-white">Numerical (NAT)</span>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={numNoNeg}
                      onChange={(e) => { setNumNoNeg(e.target.checked); setPreset('custom'); }}
                      className="w-3.5 h-3.5 rounded border-instrument-steel/40 text-circuit-amber bg-blueprint-bg focus:ring-circuit-amber"
                    />
                    <span className="text-[10px] font-mono text-instrument-steel uppercase tracking-wider">No Neg</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-mono font-bold text-instrument-steel uppercase tracking-wider">Correct</label>
                    <input
                      type="number"
                      value={numPos}
                      onChange={(e) => { setNumPos(Number(e.target.value)); setPreset('custom'); }}
                      className="w-full text-xs font-mono px-2.5 py-1.5 border border-instrument-steel/30 bg-blueprint-bg text-chalk-white rounded focus:border-circuit-amber outline-none transition duration-150"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono font-bold text-instrument-steel uppercase tracking-wider">Deducted per wrong answer</label>
                    <input
                      type="number"
                      value={numNeg}
                      disabled={numNoNeg}
                      onChange={(e) => { 
                        const val = Number(e.target.value); 
                        setNumNeg(val === 0 ? 0 : -Math.abs(val)); 
                        setPreset('custom'); 
                      }}
                      className="w-full text-xs font-mono px-2.5 py-1.5 border border-instrument-steel/30 bg-blueprint-bg text-chalk-white rounded focus:border-circuit-amber outline-none transition duration-150 disabled:bg-blueprint-bg/20 disabled:text-instrument-steel/40"
                    />
                  </div>
                </div>
              </div>

              {/* Subjective Scheme */}
              <div className="border-t border-instrument-steel/10 pt-3.5 space-y-2">
                <span className="text-xs font-mono font-bold text-chalk-white block">Subjective (Self-Marked)</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-mono font-bold text-instrument-steel uppercase tracking-wider">Correct</label>
                    <input
                      type="number"
                      value={subPos}
                      onChange={(e) => { setSubPos(Number(e.target.value)); setPreset('custom'); }}
                      className="w-full text-xs font-mono px-2.5 py-1.5 border border-instrument-steel/30 bg-blueprint-bg text-chalk-white rounded focus:border-circuit-amber outline-none transition duration-150"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono font-bold text-instrument-steel uppercase tracking-wider">Deducted per wrong answer</label>
                    <input
                      type="number"
                      value={subNeg}
                      onChange={(e) => { 
                        const val = Number(e.target.value); 
                        setSubNeg(val === 0 ? 0 : -Math.abs(val)); 
                        setPreset('custom'); 
                      }}
                      className="w-full text-xs font-mono px-2.5 py-1.5 border border-instrument-steel/30 bg-blueprint-bg text-chalk-white rounded focus:border-circuit-amber outline-none transition duration-150"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Portal Column (Right) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-graphite rounded-xl border border-instrument-steel/20 shadow-sm overflow-hidden flex flex-col min-h-[500px] lg:h-[520px]">
            {/* Tabs */}
            <div className="flex flex-col sm:flex-row border-b border-instrument-steel/20 bg-blueprint-bg/50">
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-3 px-2 sm:py-3.5 sm:px-4 text-[10px] sm:text-xs font-mono font-bold flex items-center justify-center gap-1.5 border-b-2 sm:border-b-2 transition duration-150 cursor-pointer ${
                  activeTab === 'upload'
                    ? 'border-circuit-amber text-circuit-amber bg-graphite'
                    : 'border-transparent text-instrument-steel hover:text-chalk-white hover:bg-graphite/40'
                }`}
              >
                <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>UPLOAD .TEX / .LATEX</span>
              </button>
              <button
                onClick={() => setActiveTab('paste')}
                className={`flex-1 py-3 px-2 sm:py-3.5 sm:px-4 text-[10px] sm:text-xs font-mono font-bold flex items-center justify-center gap-1.5 border-b-2 sm:border-b-2 transition duration-150 cursor-pointer ${
                  activeTab === 'paste'
                    ? 'border-circuit-amber text-circuit-amber bg-graphite'
                    : 'border-transparent text-instrument-steel hover:text-chalk-white hover:bg-graphite/40'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>PASTE TEX CODE</span>
              </button>
              <button
                onClick={() => setActiveTab('existing')}
                className={`flex-1 py-3 px-2 sm:py-3.5 sm:px-4 text-[10px] sm:text-xs font-mono font-bold flex items-center justify-center gap-1.5 border-b-2 sm:border-b-2 transition duration-150 cursor-pointer ${
                  activeTab === 'existing'
                    ? 'border-circuit-amber text-circuit-amber bg-graphite'
                    : 'border-transparent text-instrument-steel hover:text-chalk-white hover:bg-graphite/40'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>AVAILABLE TESTS ({existingTests.length})</span>
              </button>
            </div>

            {/* Tab Panels */}
            <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
              {activeTab === 'upload' && (
                <div className="space-y-6 h-full flex flex-col justify-center">
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition duration-150 flex flex-col items-center justify-center flex-1 ${
                      isDragActive
                        ? 'border-circuit-amber bg-blueprint-bg/40'
                        : 'border-instrument-steel/20 hover:border-circuit-amber/60 hover:bg-blueprint-bg/20'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".tex,.latex"
                      className="hidden"
                    />
                    <div className="p-4 bg-blueprint-bg text-circuit-amber border border-instrument-steel/20 rounded-full mb-3">
                      <Upload className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-serif font-bold text-chalk-white mb-1">
                      Drag & Drop your JEE .tex or .latex paper here
                    </p>
                    <p className="text-xs text-instrument-steel max-w-sm">
                      Supports LaTeX tag-schemas containing quizquestion, maths structures, and answers.
                    </p>
                    <span className="mt-4 px-4 py-2 bg-circuit-amber hover:bg-circuit-amber/90 text-blueprint-bg font-mono font-bold text-xs rounded transition duration-150 shadow-sm">
                      SELECT TEX / LATEX FILE
                    </span>
                  </div>

                  <div className="text-center">
                    <span className="text-[9px] font-mono tracking-widest text-instrument-steel block mb-2 uppercase">— OR PLAY IMMEDIATELY —</span>
                    <button
                      onClick={loadSample}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-graphite border border-circuit-amber text-circuit-amber hover:bg-circuit-amber hover:text-blueprint-bg rounded font-mono text-xs font-bold transition duration-150 cursor-pointer shadow-md"
                    >
                      <Sparkles className="w-4 h-4" />
                      LOAD SAMPLE PRACTICE MOCK
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
                    className="w-full flex-1 border border-instrument-steel/20 bg-blueprint-bg text-chalk-white rounded-lg p-3 font-mono text-xs focus:border-circuit-amber outline-none resize-none transition duration-150"
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
                      className="text-xs text-circuit-amber hover:underline font-mono font-semibold"
                    >
                      Load sample LaTeX template
                    </button>
                    <button
                      onClick={() => processContent(pasteContent)}
                      className="px-4 py-1.5 bg-blueprint-bg border border-instrument-steel/30 hover:border-circuit-amber text-chalk-white hover:text-circuit-amber text-xs font-mono font-semibold rounded transition duration-150"
                    >
                      Parse Input Now
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'existing' && (
                <div className="space-y-3 h-full">
                  {existingTests.length === 0 ? (
                    <div className="text-center py-12 text-instrument-steel flex flex-col items-center justify-center h-full">
                      <BookOpen className="w-12 h-12 text-instrument-steel/30 mb-2" />
                      <p className="text-sm font-serif">No imported tests found in your database.</p>
                      <p className="text-xs text-instrument-steel/60 font-mono mt-1">Import or paste a paper to get started.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 h-full">
                      {existingTests.map((test) => (
                        <div
                          key={test.id}
                          className="flex items-center justify-between p-4 bg-blueprint-bg/40 border border-instrument-steel/20 rounded-lg hover:border-circuit-amber/50 transition duration-150"
                        >
                          <div>
                            <p className="font-serif font-bold text-chalk-white text-sm">{test.name}</p>
                            <p className="font-mono text-[10px] text-instrument-steel mt-1">
                              {test.questions.length} questions • Created {new Date(test.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleStartExistingExam(test)}
                              className="px-3 py-1.5 bg-circuit-amber hover:bg-circuit-amber/90 text-blueprint-bg text-xs font-mono font-bold rounded shadow transition duration-150 cursor-pointer"
                            >
                              Launch Exam
                            </button>
                            <button
                              onClick={() => onDeleteTest(test.id)}
                              className="px-3 py-1.5 border border-instrument-steel/30 hover:border-red-500/50 text-instrument-steel hover:text-red-400 hover:bg-red-950/20 text-xs font-mono font-bold rounded transition duration-150 cursor-pointer"
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
            <div className="p-4 bg-blueprint-bg border-t border-instrument-steel/20 flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
              <div className="min-w-0 flex-1">
                {successInfo && (
                  <div className="flex items-center gap-1.5 text-formula-green font-medium text-xs font-mono">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{successInfo}</span>
                  </div>
                )}
                {errors.length > 0 && (
                  <div className="flex items-start gap-1.5 text-red-400 text-xs font-mono">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div className="max-w-md max-h-16 overflow-y-auto text-red-300">
                      {errors[0]} {errors.length > 1 && `(+${errors.length - 1} more errors)`}
                    </div>
                  </div>
                )}
                {!successInfo && errors.length === 0 && (
                  <span className="text-xs font-mono text-instrument-steel">Ready to load test.</span>
                )}
              </div>

              {activeTab !== 'existing' && (
                <button
                  disabled={parsedQuestionsCount === 0}
                  onClick={handleStartExam}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded text-sm font-mono font-bold select-none transition duration-150 text-center ${
                    parsedQuestionsCount > 0
                      ? 'bg-circuit-amber hover:bg-circuit-amber/90 text-blueprint-bg cursor-pointer hover:shadow-md'
                      : 'bg-graphite text-instrument-steel/40 border border-instrument-steel/10 cursor-not-allowed'
                  }`}
                >
                  START EMULATED CBT
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
