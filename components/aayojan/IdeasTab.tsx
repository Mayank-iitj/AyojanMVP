'use client';

import React, { useState } from 'react';
import { BookOpen, RefreshCw, Sparkles } from 'lucide-react';
import { RAG_TEMPLATES } from '@/lib/engine/templates';
import { EventState, IdeaItem } from '@/lib/engine/types';

interface IdeasTabProps {
  event: EventState;
  onRegenerateIdeas: (constraint: string) => Promise<void>;
}

export default function IdeasTab({
  event,
  onRegenerateIdeas,
}: IdeasTabProps) {
  const [constraint, setConstraint] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onRegenerateIdeas(
        constraint.trim() || 'Eco-friendly local artisans & strict buffer timing'
      );
      setConstraint('');
    } finally {
      setLoading(false);
    }
  };

  const sections: Array<{
    key: string;
    title: string;
    subtitle: string;
    items: IdeaItem[];
  }> = [
    {
      key: 'themes',
      title: 'Themes & Visual Direction',
      subtitle: `Matched to ${event.city} (${event.tier} tier) and ${event.brief.indoorOutdoor} setting`,
      items: event.ideas.themes,
    },
    {
      key: 'menu',
      title: 'Menu Architecture & Catering Strategy',
      subtitle: 'Regional specialties, live counters & dietary labeling',
      items: event.ideas.menu,
    },
    {
      key: 'games',
      title: 'Games, Activities & Guest Engagement',
      subtitle: 'Structured participation blocks with zero dead-time',
      items: event.ideas.games,
    },
    {
      key: 'decor',
      title: 'Decor, Florals & Spatial Production',
      subtitle: 'Cost-effective materials with high visual warmth',
      items: event.ideas.decor,
    },
    {
      key: 'runOfShow',
      title: 'Master Run-of-Show & Buffer Protocol',
      subtitle: 'Cue-by-cue sequence with built-in transition buffers',
      items: event.ideas.runOfShow,
    },
  ];

  if (
    event.ideas.permitsAndVolunteers &&
    event.ideas.permitsAndVolunteers.length > 0
  ) {
    sections.push({
      key: 'permitsAndVolunteers',
      title: 'Civic Permits, Safety & Volunteer Roster',
      subtitle: 'Municipal/Police NOC guidance & shift marshals',
      items: event.ideas.permitsAndVolunteers,
    });
  }

  const relevantRagDocs = RAG_TEMPLATES.filter(
    (doc) => doc.event_type === event.type
  );

  return (
    <div className="space-y-8">
      {/* Regenerate with Constraint Bar (FR-5) */}
      <div className="bg-white rounded-[14px] border border-[#14110F]/10 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#14110F] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#B9771B]" />
              Curated Ideas & Grounded Run-of-Show
            </h2>
            <p className="text-xs text-[#6B645C] mt-0.5">
              Every recommendation cites its seeded RAG source document (`TPL-*`). Adapt ideas with a specific constraint below.
            </p>
          </div>

          <form
            onSubmit={handleRegenerate}
            className="flex items-center gap-2 w-full md:w-auto"
          >
            <input
              type="text"
              aria-label="Constraint for regenerating ideas"
              placeholder="e.g. Zero-plastic marigold & Jain counter..."
              value={constraint}
              onChange={(e) => setConstraint(e.target.value)}
              className="flex-1 md:w-72 px-3.5 py-2 rounded-xl bg-[#FBF7F0] border border-[#14110F]/15 text-xs text-[#14110F]"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-[#14110F] text-white text-xs font-semibold hover:bg-[#14110F]/85 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              {loading ? 'Adapting...' : 'Adapt Ideas'}
            </button>
          </form>
        </div>
      </div>

      {/* Idea Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((sec) => (
          <div
            key={sec.key}
            className="bg-white rounded-[14px] border border-[#14110F]/10 p-6 flex flex-col justify-between space-y-4"
          >
            <div>
              <h3 className="font-display text-base font-semibold text-[#14110F]">
                {sec.title}
              </h3>
              <p className="text-xs text-[#6B645C] mt-0.5">{sec.subtitle}</p>

              <div className="mt-4 space-y-4">
                {sec.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[#FBF7F0] border border-[#14110F]/10 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-[#6B645C]">
                      <span className="font-semibold text-[#14110F] text-sm">
                        {item.title}
                      </span>
                      <span className="font-mono text-[11px] text-[#B9771B]">
                        Cite: {item.templateCitation}
                      </span>
                    </div>
                    <p className="text-xs text-[#14110F] leading-relaxed">
                      {item.description}
                    </p>
                    <div className="text-[11px] font-mono text-[#6B645C]">
                      Band: {item.estimatedBand}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cited RAG Knowledge Corpus Reference */}
      <div className="bg-white rounded-[14px] border border-[#14110F]/10 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4 text-[#B9771B]" />
          <h3 className="font-display text-base font-semibold text-[#14110F]">
            Grounded RAG Reference Documents ({event.type.toUpperCase()} Corpus)
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {relevantRagDocs.map((doc) => (
            <div
              key={doc.id}
              className="p-4 rounded-xl bg-[#FBF7F0] border border-[#14110F]/10 space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs font-mono text-[#B9771B]">
                <span>{doc.id}</span>
                <span>{doc.kind}</span>
              </div>
              <div className="text-xs font-semibold text-[#14110F]">
                {doc.title}
              </div>
              <p className="text-xs text-[#6B645C] leading-relaxed">
                {doc.body}
              </p>
              <div className="pt-1 text-[11px] text-[#6B645C] italic">
                Source: {doc.source}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
