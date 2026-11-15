/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import type { Request } from 'express';

export const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0045408045';

export const FIREBASE_DATABASE_ID =
  process.env.FIREBASE_DATABASE_ID ||
  process.env.VITE_FIREBASE_DATABASE_ID ||
  'ai-studio-aimoneymanagerfi-46e8f392-ad6b-419a-96c0-8a673fdd4133';

const GOOGLE_CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  idToken: string;
}

export class AuthVerificationError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 401, code = 'UNAUTHORIZED') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface CertCache {
  certs: Record<string, string>;
  expiresAtMs: number;
}

let certCache: CertCache | null = null;

async function fetchGooglePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && certCache && now < certCache.expiresAtMs) {
    return certCache.certs;
  }

  const res = await fetch(GOOGLE_CERT_URL);
  if (!res.ok) {
    throw new AuthVerificationError(
      'Unable to fetch Firebase authentication public certificates.',
      503,
      'AUTH_CERTS_UNAVAILABLE'
    );
  }

  const certs = (await res.json()) as Record<string, string>;
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const ttlSec = maxAgeMatch ? Math.max(60, parseInt(maxAgeMatch[1], 10)) : 3600;

  certCache = {
    certs,
    expiresAtMs: now + ttlSec * 1000,
  };
  return certs;
}

function decodeBase64UrlJson<T = Record<string, any>>(segment: string): T {
  const jsonStr = Buffer.from(segment, 'base64url').toString('utf8');
  return JSON.parse(jsonStr) as T;
}

export async function verifyFirebaseIdTokenString(idToken: string): Promise<VerifiedFirebaseUser> {
  if (!idToken || typeof idToken !== 'string') {
    throw new AuthVerificationError('Authentication required. Please sign in to continue.');
  }

  const parts = idToken.trim().split('.');
  if (parts.length !== 3) {
    throw new AuthVerificationError('Invalid Firebase authentication token format.');
  }

  const [headerSeg, payloadSeg, sigSeg] = parts;
  let header: { alg?: string; kid?: string; typ?: string };
  let payload: Record<string, any>;

  try {
    header = decodeBase64UrlJson(headerSeg);
    payload = decodeBase64UrlJson(payloadSeg);
  } catch {
    throw new AuthVerificationError('Malformed Firebase authentication token.');
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw new AuthVerificationError('Unsupported Firebase authentication token algorithm.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;

  if (payload.aud !== FIREBASE_PROJECT_ID) {
    throw new AuthVerificationError('Firebase token audience mismatch.');
  }
  if (payload.iss !== expectedIssuer) {
    throw new AuthVerificationError('Firebase token issuer mismatch.');
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 128) {
    throw new AuthVerificationError('Firebase token subject (UID) is invalid.');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    throw new AuthVerificationError('Firebase authentication session has expired. Please retry.', 401, 'TOKEN_EXPIRED');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new AuthVerificationError('Firebase token issued-at timestamp is invalid.');
  }
  if (typeof payload.auth_time === 'number' && payload.auth_time > nowSec + 300) {
    throw new AuthVerificationError('Firebase auth_time timestamp is invalid.');
  }

  let certs = await fetchGooglePublicCerts(false);
  let certPem = certs[header.kid];
  if (!certPem) {
    certs = await fetchGooglePublicCerts(true);
    certPem = certs[header.kid];
  }
  if (!certPem) {
    throw new AuthVerificationError('Unknown Firebase signing key ID.', 401, 'UNKNOWN_KID');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerSeg}.${payloadSeg}`);
  verifier.end();

  const signatureValid = verifier.verify(certPem, Buffer.from(sigSeg, 'base64url'));
  if (!signatureValid) {
    throw new AuthVerificationError('Invalid Firebase token signature.', 401, 'INVALID_SIGNATURE');
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    emailVerified: Boolean(payload.email_verified),
    name: typeof payload.name === 'string' ? payload.name : undefined,
    idToken: idToken.trim(),
  };
}

export async function verifyRequestFirebaseAuth(req: Request): Promise<VerifiedFirebaseUser> {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    throw new AuthVerificationError('Authorization Bearer token is required. Please sign in to use AI features.');
  }
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) {
    throw new AuthVerificationError('Invalid Authorization header format.');
  }
  return verifyFirebaseIdTokenString(match[1]);
}

// ---------------------------------------------------------------------------
// Firestore Value Marshaling (REST API v1 <-> JS Plain Objects)
// ---------------------------------------------------------------------------
export function toFirestoreValue(val: any): Record<string, any> {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (!isFinite(val)) return { doubleValue: 0 };
    if (Number.isInteger(val)) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.filter((v) => v !== undefined).map((v) => toFirestoreValue(v)),
      },
    };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export function fromFirestoreValue(fv: any): any {
  if (!fv || typeof fv !== 'object') return undefined;
  if ('nullValue' in fv) return null;
  if ('booleanValue' in fv) return Boolean(fv.booleanValue);
  if ('integerValue' in fv) return Number(fv.integerValue);
  if ('doubleValue' in fv) return Number(fv.doubleValue);
  if ('stringValue' in fv) return String(fv.stringValue);
  if ('timestampValue' in fv) return String(fv.timestampValue);
  if ('arrayValue' in fv) {
    const values = fv.arrayValue?.values;
    return Array.isArray(values) ? values.map((v: any) => fromFirestoreValue(v)) : [];
  }
  if ('mapValue' in fv) {
    const fields = fv.mapValue?.fields || {};
    return fromFirestoreFields(fields);
  }
  return undefined;
}

export function toFirestoreFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }
  return fields;
}

export function fromFirestoreFields(fields: Record<string, any> | undefined): Record<string, any> {
  const result: Record<string, any> = {};
  if (!fields) return result;
  for (const [k, v] of Object.entries(fields)) {
    result[k] = fromFirestoreValue(v);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Optional Service Account OAuth Token Cache (if env credentials configured)
// ---------------------------------------------------------------------------
interface ServiceAccountCreds {
  client_email: string;
  private_key: string;
}

let saTokenCache: { token: string; expiresAtMs: number } | null = null;

function isValidPemPrivateKey(key: string): boolean {
  if (!key || key.includes('...') || key.includes('placeholder')) return false;
  try {
    crypto.createPrivateKey(key);
    return true;
  } catch {
    return false;
  }
}

function getFirebaseServiceAccount(): ServiceAccountCreds | null {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      const pk = String(parsed.private_key || '').replace(/\\n/g, '\n');
      if (parsed.client_email && isValidPemPrivateKey(pk)) {
        return {
          client_email: parsed.client_email,
          private_key: pk,
        };
      }
    }
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      const pk = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      if (isValidPemPrivateKey(pk)) {
        return {
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          private_key: pk,
        };
      }
    }
  } catch {
    // fallback to user ID token
  }
  return null;
}

async function getServiceAccountAccessToken(): Promise<string | null> {
  try {
    const sa = getFirebaseServiceAccount();
    if (!sa) return null;

    if (saTokenCache && Date.now() < saTokenCache.expiresAtMs - 60000) {
      return saTokenCache.token;
    }

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claim = Buffer.from(
      JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/datastore',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      })
    ).toString('base64url');

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(`${header}.${claim}`);
    signer.end();
    const sig = signer.sign(sa.private_key, 'base64url');

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${header}.${claim}.${sig}`,
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;

    saTokenCache = {
      token: data.access_token,
      expiresAtMs: Date.now() + (data.expires_in || 3600) * 1000,
    };
    return data.access_token;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Firestore Store Abstraction (supports REST production + mockable test store)
// ---------------------------------------------------------------------------
export interface QuotaDocRecord {
  userId: string;
  date: string;
  timezone: string;
  questionsCount: number;
  pendingCount: number;
  pendingStartedAtMs: number;
  lastQuestionAt?: string;
  updatedAt?: string;
}

export interface FirestoreDataStore {
  getDocument(docPath: string): Promise<Record<string, any> | null>;
  setDocument(docPath: string, data: Record<string, any>): Promise<void>;
  listCollection(collectionPath: string): Promise<Record<string, any>[]>;
  runQuotaTransaction<T>(
    docPath: string,
    handler: (
      existing: Record<string, any> | null
    ) => { writeData?: Record<string, any>; result: T }
  ): Promise<T>;
}

export class FirestoreRestStore implements FirestoreDataStore {
  private bearerToken: string;
  private databaseRoot: string;
  private documentsRoot: string;

  constructor(userIdToken: string) {
    this.bearerToken = userIdToken;
    this.databaseRoot = `projects/${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DATABASE_ID}`;
    this.documentsRoot = `${this.databaseRoot}/documents`;
  }

  private async getAuthToken(): Promise<string> {
    const saToken = await getServiceAccountAccessToken();
    return saToken || this.bearerToken;
  }

  private baseUrl(): string {
    return `https://firestore.googleapis.com/v1/${this.documentsRoot}`;
  }

  async getDocumentWithMeta(
    docPath: string
  ): Promise<{ data: Record<string, any>; updateTime?: string } | null> {
    const token = await this.getAuthToken();
    const res = await fetch(`${this.baseUrl()}/${docPath}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Firestore getDocument failed (${res.status}): ${errText}`);
    }
    const doc = (await res.json()) as { fields?: Record<string, any>; updateTime?: string };
    return {
      data: fromFirestoreFields(doc.fields),
      updateTime: doc.updateTime,
    };
  }

  async getDocument(docPath: string): Promise<Record<string, any> | null> {
    const meta = await this.getDocumentWithMeta(docPath);
    return meta ? meta.data : null;
  }

  async setDocument(docPath: string, data: Record<string, any>): Promise<void> {
    const token = await this.getAuthToken();
    const res = await fetch(`${this.baseUrl()}/${docPath}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: toFirestoreFields(data) }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Firestore setDocument failed (${res.status}): ${errText}`);
    }
  }

  async listCollection(collectionPath: string): Promise<Record<string, any>[]> {
    const token = await this.getAuthToken();
    const segments = collectionPath.split('/').filter(Boolean);
    const collectionId = segments.pop();
    if (!collectionId) return [];
    const parentRelPath = segments.join('/');
    const runQueryUrl = parentRelPath
      ? `${this.baseUrl()}/${parentRelPath}:runQuery`
      : `${this.baseUrl()}:runQuery`;

    const res = await fetch(runQueryUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          limit: 5000,
        },
      }),
    });

    if (res.status === 404) return [];
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Firestore listCollection failed (${res.status}): ${errText}`);
    }

    const rows = (await res.json()) as Array<{
      document?: { name: string; fields?: Record<string, any> };
    }>;

    const items: Record<string, any>[] = [];
    for (const row of rows || []) {
      if (!row?.document) continue;
      const docId = row.document.name.split('/').pop() || '';
      const parsed = fromFirestoreFields(row.document.fields);
      if (!parsed.id && docId) parsed.id = docId;
      items.push(parsed);
    }

    return items;
  }

  async runQuotaTransaction<T>(
    docPath: string,
    handler: (
      existing: Record<string, any> | null
    ) => { writeData?: Record<string, any>; result: T }
  ): Promise<T> {
    const maxAttempts = 6;
    const fullDocName = `${this.documentsRoot}/${docPath}`;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const token = await this.getAuthToken();
      const existingMeta = await this.getDocumentWithMeta(docPath);
      const outcome = handler(existingMeta ? existingMeta.data : null);

      if (!outcome.writeData) {
        return outcome.result;
      }

      const precondition = existingMeta?.updateTime
        ? { updateTime: existingMeta.updateTime }
        : existingMeta
        ? { exists: true }
        : { exists: false };

      const commitRes = await fetch(`${this.baseUrl()}:commit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          writes: [
            {
              currentDocument: precondition,
              update: {
                name: fullDocName,
                fields: toFirestoreFields(outcome.writeData),
              },
            },
          ],
        }),
      });

      if (commitRes.ok) {
        return outcome.result;
      }

      const commitErrText = await commitRes.text().catch(() => '');
      const isCasConflict =
        commitRes.status === 409 ||
        commitRes.status === 412 ||
        (commitRes.status === 400 &&
          (commitErrText.includes('FAILED_PRECONDITION') ||
            commitErrText.includes('ALREADY_EXISTS') ||
            commitErrText.includes('does not match') ||
            commitErrText.includes('ABORTED')));

      if (isCasConflict && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 35 * attempt + Math.floor(Math.random() * 55)));
        continue;
      }

      throw new Error(`Firestore quota commit failed (${commitRes.status}): ${commitErrText}`);
    }

    throw new Error('Firestore quota transaction exhausted maximum retry attempts.');
  }
}

// ---------------------------------------------------------------------------
// Timezone-Aware Midnight Reset & Persistent AI Chat Quota Manager
// ---------------------------------------------------------------------------
export const DEFAULT_USER_TIMEZONE = 'Asia/Kolkata';
export const FREE_DAILY_AI_CHAT_LIMIT = 1;
const STALE_PENDING_LEASE_MS = 90_000;

export function normalizeTimezone(tz?: string): string {
  if (!tz || typeof tz !== 'string') return DEFAULT_USER_TIMEZONE;
  const candidate = tz.trim();
  if (!candidate) return DEFAULT_USER_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_USER_TIMEZONE;
  }
}

function getZonedDateTimeParts(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const pick = (type: string) => {
    const found = parts.find((p) => p.type === type)?.value || '0';
    return parseInt(found, 10);
  };

  let hour = pick('hour');
  if (hour === 24) hour = 0;

  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour,
    minute: pick('minute'),
    second: pick('second'),
  };
}

export function getTimezoneDateInfo(timezoneInput?: string, now: Date = new Date()): {
  timezone: string;
  dateKey: string;
  resetAt: string;
} {
  const timezone = normalizeTimezone(timezoneInput);
  const zoned = getZonedDateTimeParts(now, timezone);

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateKey = `${zoned.year}-${pad(zoned.month)}-${pad(zoned.day)}`;

  // Compute exact UTC instant of next local midnight (00:00:00 of tomorrow in target timezone)
  const targetTomorrowUtcApprox = Date.UTC(zoned.year, zoned.month - 1, zoned.day + 1, 0, 0, 0);
  // Calculate timezone offset in ms at approximately tomorrow midnight
  const probeDate = new Date(targetTomorrowUtcApprox);
  const probeZoned = getZonedDateTimeParts(probeDate, timezone);
  const probeAsUtcMs = Date.UTC(
    probeZoned.year,
    probeZoned.month - 1,
    probeZoned.day,
    probeZoned.hour,
    probeZoned.minute,
    probeZoned.second
  );
  const offsetMs = probeAsUtcMs - targetTomorrowUtcApprox;
  const resetAtMs = targetTomorrowUtcApprox - offsetMs;

  return {
    timezone,
    dateKey,
    resetAt: new Date(resetAtMs).toISOString(),
  };
}

export function isActivePaidProUser(profile: Record<string, any> | null): boolean {
  if (!profile) return false;
  const isProFlag = Boolean(profile.isPro ?? profile.subscription?.isPro);
  if (!isProFlag) return false;

  const status = profile.subscription?.status || profile.subscriptionStatus;
  if (status === 'cancelled' || status === 'expired') return false;

  const expiry = profile.expiryDate || profile.subscription?.expiryDate;
  if (expiry && typeof expiry === 'string') {
    const expiryMs = new Date(expiry).getTime();
    if (!isNaN(expiryMs) && expiryMs <= Date.now()) {
      return false;
    }
  }

  return true;
}

export interface QuotaStatusResponse {
  isPro: boolean;
  questionsRemaining: number;
  questionsUsed: number;
  limit: number | null; // null = unlimited for Pro
  date: string;
  timezone: string;
  resetAt: string;
  dailyLimitReached: boolean;
}

export interface AcquiredSlotResult {
  allowed: boolean;
  isPro: boolean;
  leaseRequired: boolean;
  status: QuotaStatusResponse;
}

export class AiQuotaService {
  static async getStatus(
    store: FirestoreDataStore,
    uid: string,
    timezoneInput?: string,
    isProUser = false,
    now: Date = new Date()
  ): Promise<QuotaStatusResponse> {
    const { timezone, dateKey, resetAt } = getTimezoneDateInfo(timezoneInput, now);
    if (isProUser) {
      return {
        isPro: true,
        questionsRemaining: 999999,
        questionsUsed: 0,
        limit: null,
        date: dateKey,
        timezone,
        resetAt,
        dailyLimitReached: false,
      };
    }

    const docPath = `users/${uid}/ai_usage/${dateKey}`;
    const doc = await store.getDocument(docPath);
    const questionsCount = Math.max(0, Number(doc?.questionsCount || 0));
    const pendingCount =
      Number(doc?.pendingCount || 0) > 0 &&
      now.getTime() - Number(doc?.pendingStartedAtMs || 0) < STALE_PENDING_LEASE_MS
        ? 1
        : 0;

    const effectiveUsed = questionsCount + pendingCount;
    const remaining = Math.max(0, FREE_DAILY_AI_CHAT_LIMIT - effectiveUsed);

    return {
      isPro: false,
      questionsRemaining: remaining,
      questionsUsed: questionsCount,
      limit: FREE_DAILY_AI_CHAT_LIMIT,
      date: dateKey,
      timezone,
      resetAt,
      dailyLimitReached: remaining <= 0,
    };
  }

  /**
   * Atomically reserves a 1-query slot before calling Gemini.
   * Prevents concurrent requests across multiple backend instances from bypassing the 1/day limit.
   */
  static async acquireChatSlot(
    store: FirestoreDataStore,
    uid: string,
    timezoneInput?: string,
    isProUser = false,
    now: Date = new Date()
  ): Promise<AcquiredSlotResult> {
    const { timezone, dateKey, resetAt } = getTimezoneDateInfo(timezoneInput, now);

    if (isProUser) {
      return {
        allowed: true,
        isPro: true,
        leaseRequired: false,
        status: {
          isPro: true,
          questionsRemaining: 999999,
          questionsUsed: 0,
          limit: null,
          date: dateKey,
          timezone,
          resetAt,
          dailyLimitReached: false,
        },
      };
    }

    const docPath = `users/${uid}/ai_usage/${dateKey}`;
    const nowMs = now.getTime();
    const nowIso = now.toISOString();

    return store.runQuotaTransaction<AcquiredSlotResult>(docPath, (existing) => {
      const completed = Math.max(0, Number(existing?.questionsCount || 0));
      const rawPending = Math.max(0, Number(existing?.pendingCount || 0));
      const pendingStartedAtMs = Number(existing?.pendingStartedAtMs || 0);
      const effectivePending =
        rawPending > 0 && nowMs - pendingStartedAtMs < STALE_PENDING_LEASE_MS ? rawPending : 0;

      if (completed + effectivePending >= FREE_DAILY_AI_CHAT_LIMIT) {
        return {
          result: {
            allowed: false,
            isPro: false,
            leaseRequired: false,
            status: {
              isPro: false,
              questionsRemaining: 0,
              questionsUsed: completed,
              limit: FREE_DAILY_AI_CHAT_LIMIT,
              date: dateKey,
              timezone,
              resetAt,
              dailyLimitReached: true,
            },
          },
        };
      }

      const writeData: Record<string, any> = {
        userId: uid,
        date: dateKey,
        timezone,
        questionsCount: completed,
        pendingCount: 1,
        pendingStartedAtMs: nowMs,
        updatedAt: nowIso,
      };
      if (existing?.lastQuestionAt) {
        writeData.lastQuestionAt = existing.lastQuestionAt;
      }

      return {
        writeData,
        result: {
          allowed: true,
          isPro: false,
          leaseRequired: true,
          status: {
            isPro: false,
            questionsRemaining: 0,
            questionsUsed: completed,
            limit: FREE_DAILY_AI_CHAT_LIMIT,
            date: dateKey,
            timezone,
            resetAt,
            dailyLimitReached: false,
          },
        },
      };
    });
  }

  /**
   * Commits quota consumption ONLY after Gemini succeeds with a valid response.
   */
  static async commitChatSlot(
    store: FirestoreDataStore,
    uid: string,
    timezoneInput?: string,
    now: Date = new Date()
  ): Promise<QuotaStatusResponse> {
    const { timezone, dateKey, resetAt } = getTimezoneDateInfo(timezoneInput, now);
    const docPath = `users/${uid}/ai_usage/${dateKey}`;
    const nowIso = now.toISOString();

    return store.runQuotaTransaction<QuotaStatusResponse>(docPath, (existing) => {
      const prevCount = Math.max(0, Number(existing?.questionsCount || 0));
      const nextCount = prevCount + 1;
      const remaining = Math.max(0, FREE_DAILY_AI_CHAT_LIMIT - nextCount);

      return {
        writeData: {
          userId: uid,
          date: dateKey,
          timezone,
          questionsCount: nextCount,
          pendingCount: 0,
          pendingStartedAtMs: 0,
          lastQuestionAt: nowIso,
          updatedAt: nowIso,
        },
        result: {
          isPro: false,
          questionsRemaining: remaining,
          questionsUsed: nextCount,
          limit: FREE_DAILY_AI_CHAT_LIMIT,
          date: dateKey,
          timezone,
          resetAt,
          dailyLimitReached: remaining <= 0,
        },
      };
    });
  }

  /**
   * Releases the temporary reservation if Gemini fails, times out, or returns invalid output.
   * Ensures failed AI calls NEVER consume the user's daily free quota.
   */
  static async releaseChatSlot(
    store: FirestoreDataStore,
    uid: string,
    timezoneInput?: string,
    now: Date = new Date()
  ): Promise<QuotaStatusResponse> {
    const { timezone, dateKey, resetAt } = getTimezoneDateInfo(timezoneInput, now);
    const docPath = `users/${uid}/ai_usage/${dateKey}`;
    const nowIso = now.toISOString();

    return store.runQuotaTransaction<QuotaStatusResponse>(docPath, (existing) => {
      const completed = Math.max(0, Number(existing?.questionsCount || 0));
      const remaining = Math.max(0, FREE_DAILY_AI_CHAT_LIMIT - completed);

      const writeData: Record<string, any> = {
        userId: uid,
        date: dateKey,
        timezone,
        questionsCount: completed,
        pendingCount: 0,
        pendingStartedAtMs: 0,
        updatedAt: nowIso,
      };
      if (existing?.lastQuestionAt) {
        writeData.lastQuestionAt = existing.lastQuestionAt;
      }

      return {
        writeData,
        result: {
          isPro: false,
          questionsRemaining: remaining,
          questionsUsed: completed,
          limit: FREE_DAILY_AI_CHAT_LIMIT,
          date: dateKey,
          timezone,
          resetAt,
          dailyLimitReached: remaining <= 0,
        },
      };
    });
  }
}
