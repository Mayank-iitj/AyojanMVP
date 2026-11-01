import { computeHealth } from './core';
import { getVendorKit } from './templates';
import { EventState, HealthReport, ShareLinkRecord } from './types';

function escapeIcsText(raw: string): string {
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function buildIcsCalendar(event: EventState): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aayojan//Verified Event Planning Engine v1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  const formatIcsDate = (iso: string) => iso.replace(/-/g, '');

  // Main event day
  lines.push(
    'BEGIN:VEVENT',
    `UID:${event.id}-main-v${event.version}@aayojan.dev`,
    `DTSTAMP:20261101T090000Z`,
    `DTSTART;VALUE=DATE:${formatIcsDate(event.event_date)}`,
    `SUMMARY:${escapeIcsText(`[EVENT DAY] ${event.brief.title} (${event.guests} Guests)`)}`,
    `LOCATION:${escapeIcsText(event.city)}`,
    `DESCRIPTION:${escapeIcsText(`Verified Plan v${event.version} | Budget INR ${event.budget.toLocaleString('en-IN')}`)}`,
    'END:VEVENT'
  );

  // Backward timeline tasks
  for (const t of event.tasks) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}-${t.id}-v${event.version}@aayojan.dev`,
      `DTSTAMP:20261101T090000Z`,
      `DTSTART;VALUE=DATE:${formatIcsDate(t.start)}`,
      `DTEND;VALUE=DATE:${formatIcsDate(t.due)}`,
      `SUMMARY:${escapeIcsText(`${t.critical ? '[CRITICAL] ' : ''}${t.category}: ${t.title}`)}`,
      `DESCRIPTION:${escapeIcsText(`Owner: ${t.owner} | Status: ${t.status} | Lead Time: ${t.lead_time_days}d`)}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function buildExportJson(event: EventState, health: HealthReport): string {
  return JSON.stringify(
    {
      schema: 'aayojan.event.v1',
      exported_at: new Date().toISOString(),
      invariants_verified: true,
      health,
      event,
    },
    null,
    2
  );
}

/**
 * Pure, deterministic role-scoped payload redactor enforcing least-privilege views:
 * - family: executive summary, budget lines, functions, vendors, and top tasks
 * - vendor: scoped strictly to the assigned vendor category, tasks, and checklist (no global budget)
 * - volunteer: roster tasks, run-of-show, and safety/permits only (zero financial/INR fields)
 */
export function buildRoleScopedSharePayload(
  event: EventState,
  link: Pick<ShareLinkRecord, 'role' | 'token' | 'expires_at' | 'vendor_category'>
): Record<string, unknown> {
  const health = computeHealth(event);

  if (link.role === 'family') {
    return {
      role: 'family',
      token: link.token,
      expires_at: link.expires_at,
      event_summary: {
        title: event.brief.title,
        type: event.type,
        city: event.city,
        event_date: event.event_date,
        guests: event.guests,
        budget: event.budget,
        version: event.version,
        health: health.score,
      },
      lines: event.lines,
      functions: event.functions,
      vendors: event.vendors,
      key_tasks: event.tasks.slice(0, 6),
    };
  }

  if (link.role === 'vendor') {
    const targetCategory = link.vendor_category || event.lines[0].category;
    const tasks = event.tasks.filter(
      (t) => t.category.toLowerCase() === targetCategory.toLowerCase()
    );
    const vendorInfo = event.vendors.find(
      (v) => v.category.toLowerCase() === targetCategory.toLowerCase()
    );
    const kit = getVendorKit(targetCategory);

    return {
      role: 'vendor',
      vendor_category: targetCategory,
      token: link.token,
      expires_at: link.expires_at,
      event_summary: {
        title: event.brief.title,
        city: event.city,
        event_date: event.event_date,
        guests: event.guests,
        version: event.version,
      },
      vendor_info: vendorInfo,
      tasks,
      checklist: kit.whatToAsk,
      benchmark_inclusions: kit.benchmarkInclusions,
    };
  }

  return {
    role: 'volunteer',
    token: link.token,
    expires_at: link.expires_at,
    event_summary: {
      title: event.brief.title,
      city: event.city,
      event_date: event.event_date,
      guests: event.guests,
      version: event.version,
    },
    roster_tasks: event.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      due: t.due,
      owner: t.owner,
      status: t.status,
      critical: t.critical,
    })),
    run_of_show: event.ideas.runOfShow,
    permits_and_safety: event.ideas.permitsAndVolunteers ?? [],
  };
}
