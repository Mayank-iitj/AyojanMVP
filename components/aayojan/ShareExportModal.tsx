'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  Printer,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { buildExportJson, buildIcsCalendar } from '@/lib/engine/export-utils';
import {
  EventState,
  HealthReport,
  ShareLinkRecord,
  ShareRole,
} from '@/lib/engine/types';

interface ShareExportModalProps {
  open: boolean;
  event: EventState;
  health: HealthReport;
  shareLinks: ShareLinkRecord[];
  onClose: () => void;
  onCreateShare: (role: ShareRole, vendorCategory?: string) => Promise<void>;
  onRevokeShare: (token: string) => Promise<void>;
}

export default function ShareExportModal({
  open,
  event,
  health,
  shareLinks,
  onClose,
  onCreateShare,
  onRevokeShare,
}: ShareExportModalProps) {
  const [role, setRole] = useState<ShareRole>('family');
  const [vendorCategory, setVendorCategory] = useState<string>(
    event.lines[0]?.category ?? 'Catering'
  );
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  if (!open) return null;

  const activeLinks = shareLinks.filter((s) => !s.revoked_at);

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/s/${token}`;
    navigator.clipboard?.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const triggerDownload = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadIcs = () => {
    const ics = buildIcsCalendar(event);
    triggerDownload(`${event.id}-v${event.version}.ics`, ics, 'text/calendar');
  };

  const handleDownloadJson = () => {
    const json = buildExportJson(event, health);
    triggerDownload(
      `${event.id}-v${event.version}.json`,
      json,
      'application/json'
    );
  };

  const handlePrintPdf = () => {
    onClose();
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share and Export Plan"
      className="fixed inset-0 z-50 bg-[#14110F]/50 backdrop-blur-xs flex items-start justify-center pt-14 px-4 overflow-y-auto pb-12"
    >
      <div className="w-full max-w-2xl bg-white rounded-[14px] border border-[#14110F]/15 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-[#14110F]/10 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#14110F] flex items-center gap-2">
              <Share2 className="w-4 h-4 text-[#B9771B]" />
              Role-Scoped Share Links & Verified Exports
            </h2>
            <p className="text-xs text-[#6B645C] mt-0.5">
              Share read-only role views (Family, Vendor, Volunteer) or export immutable Version {event.version} snapshots.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share modal"
            className="p-1.5 rounded-lg text-[#6B645C] hover:text-[#14110F]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 1. Export Snapshot Buttons (FR-12) */}
          <div>
            <div className="text-xs font-semibold text-[#14110F] mb-2.5">
              Export Immutable Version {event.version} Snapshot
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={handlePrintPdf}
                className="p-3.5 rounded-xl bg-[#FBF7F0] hover:bg-[#E8A33D]/20 border border-[#14110F]/15 text-left transition-colors flex items-center gap-3 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-[#B9771B] shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-[#14110F]">
                    PDF Plan Report
                  </div>
                  <div className="text-[11px] text-[#6B645C]">
                    Print-ready brief & ledger
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleDownloadIcs}
                className="p-3.5 rounded-xl bg-[#FBF7F0] hover:bg-[#E8A33D]/20 border border-[#14110F]/15 text-left transition-colors flex items-center gap-3 cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-[#B9771B] shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-[#14110F]">
                    .ICS Calendar
                  </div>
                  <div className="text-[11px] text-[#6B645C]">
                    All {event.tasks.length} scheduled tasks
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleDownloadJson}
                className="p-3.5 rounded-xl bg-[#FBF7F0] hover:bg-[#E8A33D]/20 border border-[#14110F]/15 text-left transition-colors flex items-center gap-3 cursor-pointer"
              >
                <FileJson className="w-4 h-4 text-[#B9771B] shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-[#14110F]">
                    Verified .JSON
                  </div>
                  <div className="text-[11px] text-[#6B645C]">
                    Full state + health report
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Create Role-Scoped Share Link (FR-11) */}
          <div className="pt-4 border-t border-[#14110F]/10 space-y-3">
            <div className="text-xs font-semibold text-[#14110F]">
              Generate Expiring Role-Scoped Link
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-5">
                <label
                  htmlFor="share-role-select"
                  className="block text-[11px] text-[#6B645C] mb-1"
                >
                  Collaborator Role Scope
                </label>
                <select
                  id="share-role-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value as ShareRole)}
                  className="w-full px-3 py-2 rounded-lg bg-[#FBF7F0] border border-[#14110F]/15 text-xs text-[#14110F]"
                >
                  <option value="family">
                    Family (Budget, Functions & Approvals)
                  </option>
                  <option value="vendor">
                    Vendor (Own Category Tasks Only)
                  </option>
                  <option value="volunteer">
                    Volunteer (Roster & Run-of-Show Only)
                  </option>
                </select>
              </div>

              {role === 'vendor' && (
                <div className="sm:col-span-4">
                  <label
                    htmlFor="share-vendor-cat"
                    className="block text-[11px] text-[#6B645C] mb-1"
                  >
                    Vendor Category Scope
                  </label>
                  <select
                    id="share-vendor-cat"
                    value={vendorCategory}
                    onChange={(e) => setVendorCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#FBF7F0] border border-[#14110F]/15 text-xs text-[#14110F]"
                  >
                    {event.lines
                      .filter((l) => l.category !== 'Contingency')
                      .map((l) => (
                        <option key={l.category} value={l.category}>
                          {l.category}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className={role === 'vendor' ? 'sm:col-span-3' : 'sm:col-span-7'}>
                <button
                  type="button"
                  onClick={() =>
                    onCreateShare(
                      role,
                      role === 'vendor' ? vendorCategory : undefined
                    )
                  }
                  className="w-full px-4 py-2 rounded-lg bg-[#14110F] text-white text-xs font-semibold hover:bg-[#14110F]/85 transition-colors cursor-pointer"
                >
                  Create Role Link
                </button>
              </div>
            </div>
          </div>

          {/* 3. Active Share Links List */}
          <div className="pt-4 border-t border-[#14110F]/10 space-y-2.5">
            <div className="text-xs font-semibold text-[#14110F]">
              Active Share Links ({activeLinks.length})
            </div>

            {activeLinks.length === 0 ? (
              <p className="text-xs text-[#6B645C]">
                No active share links for this event yet. Create one above.
              </p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {activeLinks.map((sl) => (
                  <div
                    key={sl.token}
                    className="p-3 rounded-xl bg-[#FBF7F0] border border-[#14110F]/10 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-[#14110F]">
                        Role: {sl.role.toUpperCase()}
                        {sl.vendor_category ? ` (${sl.vendor_category})` : ''}
                      </div>
                      <div className="font-mono text-[11px] text-[#6B645C]">
                        /s/{sl.token} · Expires {sl.expires_at.slice(0, 10)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(sl.token)}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-[#14110F]/15 text-[#14110F] hover:bg-[#14110F]/5 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedToken === sl.token ? (
                          <>
                            <Check className="w-3 h-3 text-[#2F7D5B]" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copy URL
                          </>
                        )}
                      </button>

                      <Link
                        href={`/s/${sl.token}`}
                        onClick={onClose}
                        className="px-2.5 py-1.5 rounded-lg bg-[#14110F] text-white hover:bg-[#14110F]/85 flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open Role View
                      </Link>

                      <button
                        type="button"
                        onClick={() => onRevokeShare(sl.token)}
                        aria-label={`Revoke ${sl.role} share link`}
                        className="p-1.5 rounded-lg text-[#B3402F] hover:bg-[#B3402F]/10 cursor-pointer"
                        title="Revoke link"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
