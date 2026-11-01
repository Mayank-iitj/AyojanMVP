'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  Check,
  Copy,
  HelpCircle,
  MessageSquare,
  PlusCircle,
  Send,
  XCircle,
} from 'lucide-react';
import { generateVendorOutreachDraft } from '@/lib/engine/nlp-compiler';
import { getVendorKit } from '@/lib/engine/templates';
import { EventState, QuoteRecord, TypedOp } from '@/lib/engine/types';

interface VendorsTabProps {
  event: EventState;
  quotes: QuoteRecord[];
  onCommitOps: (ops: TypedOp[], cause: string) => Promise<void>;
  onAddQuote: (quote: {
    category: string;
    vendor_name: string;
    amount: number;
    capacity?: number;
    inclusions: string;
  }) => Promise<void>;
}

export default function VendorsTab({
  event,
  quotes,
  onCommitOps,
  onAddQuote,
}: VendorsTabProps) {
  const categories = event.lines
    .filter((l) => l.category !== 'Contingency')
    .map((l) => l.category);

  const [selectedCategory, setSelectedCategory] = useState<string>(
    categories[0] ?? 'Catering'
  );
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [language, setLanguage] = useState<'hinglish' | 'english'>('hinglish');
  const [copied, setCopied] = useState(false);

  // Add quote form state
  const [newVendorName, setNewVendorName] = useState('');
  const [newQuoteAmount, setNewQuoteAmount] = useState('');
  const [newQuoteCapacity, setNewQuoteCapacity] = useState('');
  const [newQuoteInclusions, setNewQuoteInclusions] = useState('');
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const activeCategory = categories.includes(selectedCategory)
    ? selectedCategory
    : categories[0];

  const kit = getVendorKit(activeCategory);
  const activeVendor = event.vendors.find(
    (v) => v.category.toLowerCase() === activeCategory.toLowerCase()
  );
  const categoryLine = event.lines.find(
    (l) => l.category.toLowerCase() === activeCategory.toLowerCase()
  );

  const categoryQuotes = quotes
    .filter((q) => q.category.toLowerCase() === activeCategory.toLowerCase())
    .sort((a, b) => a.amount - b.amount);

  const bestValueQuoteId = categoryQuotes[0]?.id;

  const draft = generateVendorOutreachDraft({
    state: event,
    category: activeCategory,
    channel,
    language,
  });

  const handleCopyDraft = () => {
    navigator.clipboard?.writeText(draft.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.round(Number(newQuoteAmount));
    if (!newVendorName.trim() || isNaN(amt) || amt < 1000) {
      setQuoteError('Provide a vendor name and integer quote amount (≥ ₹1,000).');
      return;
    }
    setQuoteError(null);
    await onAddQuote({
      category: activeCategory,
      vendor_name: newVendorName.trim(),
      amount: amt,
      capacity: newQuoteCapacity ? Math.round(Number(newQuoteCapacity)) : undefined,
      inclusions:
        newQuoteInclusions.trim() || kit.benchmarkInclusions,
    });
    setNewVendorName('');
    setNewQuoteAmount('');
    setNewQuoteCapacity('');
    setNewQuoteInclusions('');
  };

  return (
    <div className="space-y-6">
      {/* Category Selector Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => {
          const v = event.vendors.find((item) => item.category === cat);
          const isSelected = cat === activeCategory;
          const isCancelled = v?.status === 'cancelled';

          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2.5 rounded-[14px] border text-left transition-colors shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-[#14110F] text-white border-[#14110F]'
                  : 'bg-white text-[#14110F] border-[#14110F]/15 hover:border-[#14110F]/35'
              }`}
            >
              <div className="text-xs font-semibold whitespace-nowrap">{cat}</div>
              <div
                className={`text-[11px] mt-0.5 font-mono tabular-nums ${
                  isSelected
                    ? 'text-white/75'
                    : isCancelled
                      ? 'text-[#B3402F]'
                      : 'text-[#6B645C]'
                }`}
              >
                {v?.status ?? 'shortlisted'}
                {v?.capacity ? ` · ${v.capacity} pax` : ''}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main 2-Column Split: Left = Vendor Status, Kit & Quote Table; Right = Outreach Composer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          {/* Active Vendor Card */}
          <div className="bg-white rounded-[14px] border border-[#14110F]/10 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs text-[#6B645C]">
                  Active {activeCategory} Partner · Planned Allocation ₹
                  {(categoryLine?.planned ?? 0).toLocaleString('en-IN')}
                </div>
                <h2 className="font-display text-xl font-semibold text-[#14110F] mt-1">
                  {activeVendor?.name ?? `${activeCategory} Shortlist`}
                </h2>
                <div className="mt-1 text-xs text-[#6B645C] font-mono tabular-nums">
                  Status: <strong className="text-[#14110F]">{activeVendor?.status ?? 'shortlisted'}</strong>
                  {activeVendor?.capacity && (
                    <> · Declared Venue Capacity: {activeVendor.capacity} guests (I7)</>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeVendor?.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() =>
                      onCommitOps(
                        [{ op: 'CancelVendor', category: activeCategory }],
                        `Marked ${activeCategory} vendor as cancelled; cascaded urgent replacement task`
                      )
                    }
                    className="px-3.5 py-2 rounded-lg border border-[#B3402F]/35 text-[#B3402F] hover:bg-[#B3402F]/10 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Mark Cancelled
                  </button>
                )}
              </div>
            </div>

            {/* What to Ask & Red Flags */}
            <div className="mt-6 pt-5 border-t border-[#14110F]/10 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-xs font-semibold text-[#14110F] flex items-center gap-1.5 mb-2.5">
                  <HelpCircle className="w-3.5 h-3.5 text-[#2F7D5B]" />
                  What to Ask Before Signing
                </div>
                <ul className="space-y-2 text-xs text-[#6B645C]">
                  {kit.whatToAsk.map((q, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {idx + 1}. {q}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="text-xs font-semibold text-[#B3402F] flex items-center gap-1.5 mb-2.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Contract Red Flags to Watch
                </div>
                <ul className="space-y-2 text-xs text-[#6B645C]">
                  {kit.redFlags.map((rf, idx) => (
                    <li key={idx} className="leading-relaxed">
                      • {rf}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Quote Comparison Table with Normalized Rs/Guest (FR-4) */}
          <div className="bg-white rounded-[14px] border border-[#14110F]/10 overflow-hidden">
            <div className="p-5 border-b border-[#14110F]/10 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-base font-semibold text-[#14110F]">
                  Quote Comparison Table ({activeCategory})
                </h3>
                <p className="text-xs text-[#6B645C]">
                  Normalized by {event.guests} guests (₹/guest) · Select any quote to lock vendor & capacity.
                </p>
              </div>
            </div>

            {categoryQuotes.length === 0 ? (
              <div className="p-6 text-xs text-[#6B645C]">
                No quotes logged for {activeCategory} yet. Add your first vendor quote below to compare normalized ₹/guest rates.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#14110F]/10 bg-[#FBF7F0] text-[11px] font-semibold text-[#6B645C]">
                      <th className="py-3 px-4">Vendor Name</th>
                      <th className="py-3 px-4 text-right">Total Quote</th>
                      <th className="py-3 px-4 text-right">₹ / Guest</th>
                      <th className="py-3 px-4">Inclusions & Capacity</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#14110F]/10 text-xs">
                    {categoryQuotes.map((qt) => {
                      const perGuest = Math.round(
                        qt.amount / Math.max(1, event.guests)
                      );
                      const isBestValue = qt.id === bestValueQuoteId;
                      const isSelectedVendor =
                        activeVendor?.name === qt.vendor_name &&
                        activeVendor?.status === 'booked';

                      return (
                        <tr key={qt.id} className="hover:bg-[#FBF7F0]/50">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-[#14110F]">
                              {qt.vendor_name}
                            </div>
                            {isBestValue && (
                              <div className="text-[11px] text-[#2F7D5B] font-medium flex items-center gap-1 mt-0.5">
                                <Award className="w-3 h-3" />
                                Best Value per Guest
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-[#14110F]">
                            ₹{qt.amount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#6B645C]">
                            ₹{perGuest.toLocaleString('en-IN')}/pax
                          </td>
                          <td className="py-3.5 px-4 text-[#6B645C] max-w-xs">
                            <div>{qt.inclusions}</div>
                            {qt.capacity && (
                              <div className="font-mono text-[11px] text-[#14110F] mt-0.5">
                                Declared Capacity: {qt.capacity} guests
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                onCommitOps(
                                  [
                                    {
                                      op: 'SelectVendor',
                                      category: activeCategory,
                                      name: qt.vendor_name,
                                      quote: qt.amount,
                                      capacity: qt.capacity,
                                    },
                                  ],
                                  `Selected "${qt.vendor_name}" for ${activeCategory} at ₹${qt.amount.toLocaleString('en-IN')}`
                                )
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${
                                isSelectedVendor
                                  ? 'bg-[#2F7D5B]/15 text-[#2F7D5B]'
                                  : 'bg-[#14110F] text-white hover:bg-[#14110F]/85'
                              }`}
                            >
                              {isSelectedVendor ? 'Booked' : 'Select Vendor'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add Quote Form */}
            <form
              onSubmit={handleAddQuoteSubmit}
              className="p-5 bg-[#FBF7F0] border-t border-[#14110F]/10 space-y-3"
            >
              <div className="text-xs font-semibold text-[#14110F]">
                Log New Quote for {activeCategory}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <input
                    type="text"
                    aria-label="Vendor name"
                    placeholder="Vendor name"
                    value={newVendorName}
                    onChange={(e) => setNewVendorName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#14110F]/15 text-xs"
                  />
                </div>
                <div className="sm:col-span-3">
                  <input
                    type="number"
                    aria-label="Quote total INR"
                    placeholder="Total INR (e.g. 280000)"
                    value={newQuoteAmount}
                    onChange={(e) => setNewQuoteAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#14110F]/15 text-xs font-mono"
                  />
                </div>
                <div className="sm:col-span-3">
                  <input
                    type="text"
                    aria-label="Quote inclusions"
                    placeholder="Key inclusions"
                    value={newQuoteInclusions}
                    onChange={(e) => setNewQuoteInclusions(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#14110F]/15 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full px-3 py-2 rounded-lg bg-[#14110F] text-white text-xs font-medium hover:bg-[#14110F]/85 flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Add Quote
                  </button>
                </div>
              </div>
              {quoteError && (
                <p className="text-xs text-[#B3402F]">{quoteError}</p>
              )}
            </form>
          </div>
        </div>

        {/* Right 5 Columns: Outreach Composer (WhatsApp / Email, Hinglish / English) */}
        <div className="lg:col-span-5 bg-white rounded-[14px] border border-[#14110F]/10 p-6 space-y-4 sticky top-20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-[#14110F] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#B9771B]" />
                Outreach Draft Composer
              </h3>
              <p className="text-xs text-[#6B645C] mt-0.5">
                Auto-populates {activeCategory} questions, target budget band & headcount.
              </p>
            </div>
          </div>

          {/* Channel & Language Segmented Controls */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-1 rounded-lg bg-[#FBF7F0] border border-[#14110F]/10 flex">
              <button
                type="button"
                onClick={() => setChannel('whatsapp')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  channel === 'whatsapp'
                    ? 'bg-[#14110F] text-white'
                    : 'text-[#6B645C] hover:text-[#14110F]'
                }`}
              >
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setChannel('email')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  channel === 'email'
                    ? 'bg-[#14110F] text-white'
                    : 'text-[#6B645C] hover:text-[#14110F]'
                }`}
              >
                Email RFP
              </button>
            </div>

            <div className="p-1 rounded-lg bg-[#FBF7F0] border border-[#14110F]/10 flex">
              <button
                type="button"
                onClick={() => setLanguage('hinglish')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  language === 'hinglish'
                    ? 'bg-[#E8A33D] text-[#14110F]'
                    : 'text-[#6B645C] hover:text-[#14110F]'
                }`}
              >
                Hinglish
              </button>
              <button
                type="button"
                onClick={() => setLanguage('english')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  language === 'english'
                    ? 'bg-[#E8A33D] text-[#14110F]'
                    : 'text-[#6B645C] hover:text-[#14110F]'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {draft.subject && (
            <div className="p-3 rounded-lg bg-[#FBF7F0] border border-[#14110F]/10 text-xs">
              <span className="text-[#6B645C]">Subject: </span>
              <span className="font-medium text-[#14110F]">{draft.subject}</span>
            </div>
          )}

          <div className="p-4 rounded-xl bg-[#FBF7F0] border border-[#14110F]/10 text-xs text-[#14110F] whitespace-pre-wrap leading-relaxed font-sans max-h-[300px] overflow-y-auto">
            {draft.message}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopyDraft}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#14110F] text-white text-xs font-semibold hover:bg-[#14110F]/85 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#E8A33D]" />
                  Copied to Clipboard
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy {language === 'hinglish' ? 'Hinglish' : 'English'} Draft
                </>
              )}
            </button>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(draft.message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-4 rounded-xl bg-[#2F7D5B] text-white text-xs font-semibold hover:bg-[#2F7D5B]/90 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
