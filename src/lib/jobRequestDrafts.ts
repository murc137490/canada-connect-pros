/** Local drafts for Make a Request — max 3 per signed-in user. */

export const MAX_JOB_REQUEST_DRAFTS = 3;

export type JobRequestDraftPayload = {
  step: number;
  description: string;
  postalCode: string;
  category: string;
  budgetMin: string;
  budgetMax: string;
  timing: string;
  preferredDate: string | null;
  preferredTimeWindow: string;
  availabilityMode: "range" | "specific_day" | "exact";
  rangeStartDate: string | null;
  rangeEndDate: string | null;
  startHour: string;
  endHour: string;
  exactTime: string;
};

export type JobRequestDraft = JobRequestDraftPayload & {
  id: string;
  updatedAt: string;
  title: string;
};

function storageKey(userId: string): string {
  return `premiere:job-request-drafts:v1:${userId}`;
}

function dateToIso(d: Date | undefined): string | null {
  if (!d) return null;
  try {
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function isoToDate(s: string | null | undefined): Date | undefined {
  if (!s) return undefined;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function draftTitle(description: string, fallback: string): string {
  const trimmed = description.trim().replace(/\s+/g, " ");
  if (!trimmed) return fallback;
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed;
}

export function listJobRequestDrafts(userId: string): JobRequestDraft[] {
  if (!userId || typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as JobRequestDraft[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((d) => d && typeof d.id === "string")
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, MAX_JOB_REQUEST_DRAFTS);
  } catch {
    return [];
  }
}

function writeDrafts(userId: string, drafts: JobRequestDraft[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(drafts.slice(0, MAX_JOB_REQUEST_DRAFTS)));
}

export function getJobRequestDraft(userId: string, draftId: string): JobRequestDraft | null {
  return listJobRequestDrafts(userId).find((d) => d.id === draftId) ?? null;
}

export function deleteJobRequestDraft(userId: string, draftId: string): void {
  writeDrafts(
    userId,
    listJobRequestDrafts(userId).filter((d) => d.id !== draftId)
  );
}

export type SaveDraftResult =
  | { ok: true; draft: JobRequestDraft }
  | { ok: false; reason: "empty" | "limit" };

/** Save or update a draft. Pass existingId to overwrite that slot. */
export function saveJobRequestDraft(
  userId: string,
  payload: JobRequestDraftPayload,
  options?: { existingId?: string | null; untitledLabel?: string }
): SaveDraftResult {
  if (!userId) return { ok: false, reason: "empty" };
  const hasContent =
    payload.description.trim().length > 0 ||
    payload.postalCode.trim().length > 0 ||
    payload.budgetMin.trim().length > 0 ||
    payload.budgetMax.trim().length > 0 ||
    payload.timing.trim().length > 0 ||
    payload.preferredDate != null ||
    payload.rangeStartDate != null ||
    payload.exactTime.trim().length > 0;

  if (!hasContent) return { ok: false, reason: "empty" };

  const untitled = options?.untitledLabel ?? "Draft";
  const existingId = options?.existingId ?? null;
  const drafts = listJobRequestDrafts(userId);
  const now = new Date().toISOString();

  if (existingId) {
    const idx = drafts.findIndex((d) => d.id === existingId);
    if (idx >= 0) {
      const next: JobRequestDraft = {
        ...payload,
        id: existingId,
        updatedAt: now,
        title: draftTitle(payload.description, untitled),
      };
      const copy = [...drafts];
      copy[idx] = next;
      writeDrafts(userId, copy);
      return { ok: true, draft: next };
    }
  }

  if (drafts.length >= MAX_JOB_REQUEST_DRAFTS) {
    return { ok: false, reason: "limit" };
  }

  const draft: JobRequestDraft = {
    ...payload,
    id: crypto.randomUUID(),
    updatedAt: now,
    title: draftTitle(payload.description, untitled),
  };
  writeDrafts(userId, [draft, ...drafts]);
  return { ok: true, draft };
}

/** Replace oldest draft when at limit. */
export function saveJobRequestDraftReplacingOldest(
  userId: string,
  payload: JobRequestDraftPayload,
  untitledLabel?: string
): SaveDraftResult {
  const drafts = listJobRequestDrafts(userId);
  if (drafts.length >= MAX_JOB_REQUEST_DRAFTS) {
    const oldest = [...drafts].sort((a, b) => (a.updatedAt > b.updatedAt ? 1 : -1))[0];
    if (oldest) deleteJobRequestDraft(userId, oldest.id);
  }
  return saveJobRequestDraft(userId, payload, { untitledLabel });
}

export function buildDraftPayloadFromForm(input: {
  step: number;
  description: string;
  postalCode: string;
  category: string;
  budgetMin: string;
  budgetMax: string;
  timing: string;
  preferredDate: Date | undefined;
  preferredTimeWindow: string;
  availabilityMode: "range" | "specific_day" | "exact";
  rangeStartDate: Date | undefined;
  rangeEndDate: Date | undefined;
  startHour: string;
  endHour: string;
  exactTime: string;
}): JobRequestDraftPayload {
  return {
    step: input.step,
    description: input.description,
    postalCode: input.postalCode,
    category: input.category,
    budgetMin: input.budgetMin,
    budgetMax: input.budgetMax,
    timing: input.timing,
    preferredDate: dateToIso(input.preferredDate),
    preferredTimeWindow: input.preferredTimeWindow,
    availabilityMode: input.availabilityMode,
    rangeStartDate: dateToIso(input.rangeStartDate),
    rangeEndDate: dateToIso(input.rangeEndDate),
    startHour: input.startHour,
    endHour: input.endHour,
    exactTime: input.exactTime,
  };
}

export function draftDatesFromPayload(draft: JobRequestDraftPayload) {
  return {
    preferredDate: isoToDate(draft.preferredDate),
    rangeStartDate: isoToDate(draft.rangeStartDate),
    rangeEndDate: isoToDate(draft.rangeEndDate),
  };
}
