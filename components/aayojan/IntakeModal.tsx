'use client';

import React, { useState } from 'react';
import { CheckCircle2, Loader2, Mic, Sparkles, X } from 'lucide-react';

interface IntakeModalProps {
  open: boolean;
  onClose: () => void;
  onCreateFromPrompt: (prompt: string, presetKey?: string) => Promise<void>;
}

const PERSONA_EXAMPLES = [
  {
    key: 'wedding_riya',
    label: "Riya's Jaipur Wedding (200 guests, ₹12L)",
    prompt: "Sister's wedding, 200 guests, Rs 12L, Jaipur, December",
  },
  {
    key: 'birthday_arjun',
    label: "Arjun's 10yo Birthday Quest (60 guests, ₹90k)",
    prompt: "10-year-old's mystery quest birthday in Bengaluru, 60 guests, Rs 90k, November",
  },
  {
    key: 'community_meena',
    label: "Meena's Community Diwali Mela (400 visitors, ₹4.5L)",
    prompt: 'RWA Community Diwali Mela in New Delhi, 400 visitors, Rs 4.5L, permits & 20 volunteers',
  },
];

const SSE_STAGES = [
  { key: 'parsing', label: 'Parsing Intake Brief & Assumptions' },
  { key: 'planning', label: 'Matching Curated RAG Checklists (TPL-*)' },
  { key: 'budgeting', label: 'Solving Integer Rupee Allocations (I1, I2)' },
  { key: 'scheduling', label: 'Backward Timeline & Critical Path (I3, I4, I5)' },
  { key: 'validating', label: 'Verifying All 10 Invariants & Health Score' },
  { key: 'ideas', label: 'Generating Bilingual Vendor Kits & Ideas' },
];

export default function IntakeModal({
  open,
  onClose,
  onCreateFromPrompt,
}: IntakeModalProps) {
  const [prompt, setPrompt] = useState(
    "Sister's wedding, 200 guests, Rs 12L, Jaipur, December"
  );
  const [generating, setGenerating] = useState(false);
  const [activeStageIdx, setActiveStageIdx] = useState<number>(-1);
  const [listening, setListening] = useState(false);

  if (!open) return null;

  const runWithStages = async (text: string, presetKey?: string) => {
    setGenerating(true);
    for (let i = 0; i < SSE_STAGES.length; i++) {
      setActiveStageIdx(i);
      await new Promise((r) => setTimeout(r, 95));
    }
    try {
      await onCreateFromPrompt(text, presetKey);
      onClose();
    } finally {
      setGenerating(false);
      setActiveStageIdx(-1);
    }
  };

  const handleVoiceInput = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => { lang: string; start: () => void; onresult: (e: { results: { transcript: string }[][] }) => void; onend: () => void } }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => { lang: string; start: () => void; onresult: (e: { results: { transcript: string }[][] }) => void; onend: () => void } }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setPrompt(
        "Sister's wedding, 200 guests, Rs 12L, Jaipur, December — outdoor courtyard & folk sangeet"
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    setListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) setPrompt(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create New Verified Event Plan"
      className="fixed inset-0 z-50 bg-[#14110F]/50 backdrop-blur-xs flex items-start justify-center pt-12 px-4 overflow-y-auto pb-12"
    >
      <div className="w-full max-w-2xl bg-white rounded-[14px] border border-[#14110F]/15 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-[#14110F]/10 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[#14110F]">
              Tell me about your event
            </h2>
            <p className="text-xs text-[#6B645C] mt-1">
              Describe your wedding, birthday, or community event in plain English or Hinglish. Unspecified details receive sensible, flagged assumptions.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close intake modal"
            className="p-1.5 rounded-lg text-[#6B645C] hover:text-[#14110F]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="relative">
            <textarea
              rows={3}
              aria-label="Event description prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Sister's wedding, 200 guests, Rs 12L, Jaipur, December..."
              className="w-full p-4 pr-12 rounded-xl bg-[#FBF7F0] border border-[#14110F]/20 text-sm text-[#14110F] focus:outline-none focus:border-[#14110F]"
            />
            <button
              type="button"
              onClick={handleVoiceInput}
              aria-label="Dictate event brief via voice"
              className={`absolute right-3 bottom-3 p-2 rounded-lg border transition-colors cursor-pointer ${
                listening
                  ? 'bg-[#B3402F] text-white border-[#B3402F]'
                  : 'bg-white text-[#6B645C] border-[#14110F]/15 hover:text-[#14110F]'
              }`}
              title="Voice intake (Web Speech API)"
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>

          {/* Persona Example Starter Chips */}
          <div>
            <div className="text-xs font-semibold text-[#6B645C] mb-2">
              Or launch a verified persona scenario:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {PERSONA_EXAMPLES.map((ex) => (
                <button
                  key={ex.key}
                  type="button"
                  disabled={generating}
                  onClick={() => {
                    setPrompt(ex.prompt);
                    runWithStages(ex.prompt, ex.key);
                  }}
                  className="p-3 rounded-xl bg-[#FBF7F0] hover:bg-[#E8A33D]/20 border border-[#14110F]/15 text-left transition-colors cursor-pointer"
                >
                  <div className="text-xs font-semibold text-[#14110F]">
                    {ex.label}
                  </div>
                  <div className="text-[11px] text-[#6B645C] mt-1 line-clamp-2">
                    &ldquo;{ex.prompt}&rdquo;
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Live SSE Assembly Progress Stream (FR-10) */}
          {generating && (
            <div
              aria-live="polite"
              className="p-4 rounded-xl bg-[#FBF7F0] border border-[#14110F]/15 space-y-2.5"
            >
              <div className="text-xs font-semibold text-[#14110F] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#B9771B]" />
                <span>Assembling & Validating Version 1 Plan...</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SSE_STAGES.map((st, idx) => {
                  const done = idx < activeStageIdx;
                  const active = idx === activeStageIdx;
                  return (
                    <div
                      key={st.key}
                      className={`p-2 rounded-lg text-xs flex items-center gap-2 ${
                        done
                          ? 'text-[#2F7D5B] font-medium'
                          : active
                            ? 'bg-white border border-[#B9771B] text-[#14110F] font-semibold'
                            : 'text-[#6B645C]'
                      }`}
                    >
                      <CheckCircle2
                        className={`w-3.5 h-3.5 shrink-0 ${
                          done
                            ? 'text-[#2F7D5B]'
                            : active
                              ? 'text-[#B9771B]'
                              : 'text-[#6B645C]/40'
                        }`}
                      />
                      <span className="truncate">{st.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#14110F]/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#14110F]/15 text-xs font-medium text-[#6B645C] hover:text-[#14110F] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={generating || !prompt.trim()}
              onClick={() => runWithStages(prompt)}
              className="px-5 py-2.5 rounded-xl bg-[#14110F] text-white text-xs font-semibold hover:bg-[#14110F]/85 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#E8A33D]" />
              {generating ? 'Generating Verified Plan...' : 'Generate Verified Plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
