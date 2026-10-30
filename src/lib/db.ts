import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { Pool } from "pg";
import { TUTORIAL_COURSES, TUTORIAL_QUIZZES, TUTORIAL_ASSIGNMENTS } from "./tutorials";

/* ---------------- Types ---------------- */
export type Role = "student" | "tutor" | "administrator" | "owner";
export type AccountStatus = "pending" | "verified" | "rejected" | "suspended" | "disabled";

export interface User {
  id: string; fullName: string; email: string; phone: string; passwordHash: string;
  role: Role; status: AccountStatus; createdAt: string; lastLoginAt?: string;
  avatarColor: string; bio?: string; title?: string; expertise?: string;
  qualifications?: string; experience?: string; proposedCourses?: string;
  plan: "free" | "premium"; subscriptionId?: string;
  contactVerified: boolean; payoutMethod?: "mpesa" | "bank"; payoutAccount?: string;
  notificationPrefs: { email: boolean; inApp: boolean };
  totpEnabled?: boolean;
}
/** Structured tutorial content (W3Schools-style notes) rendered by the classroom. */
export interface LessonBlock {
  type: "heading" | "text" | "code" | "example" | "tip" | "note" | "warning" | "list" | "steps" | "table" | "exercise";
  content?: string;
  code?: string;
  language?: string;
  tryit?: boolean;
  items?: string[];
  headers?: string[];
  rows?: string[][];
  answer?: string;
}
export interface Lesson {
  id: string; title: string; kind: "video" | "reading" | "audio" | "document";
  durationMin: number; isPreview: boolean; videoUrl?: string; body: string;
  resourceUrl?: string; resourceName?: string;
  blocks?: LessonBlock[];
}
export interface Section { id: string; title: string; lessons: Lesson[] }
export interface QuizQuestion { id: string; type: "mcq" | "tf" | "short"; prompt: string; options?: string[]; answer: string; explanation: string }
export interface Quiz { id: string; courseId: string; title: string; timeLimitMin: number; maxAttempts: number; passMark: number; questions: QuizQuestion[] }
export interface Assignment { id: string; courseId: string; title: string; instructions: string; dueDate: string; maxScore: number }
export interface Course {
  id: string; slug: string; title: string; subtitle: string; description: string;
  category: string; level: "Beginner" | "Intermediate" | "Advanced" | "All levels";
  access: "free" | "premium"; tutorId: string;
  status: "draft" | "in_review" | "approved" | "rejected" | "published" | "unpublished";
  image: string; objectives: string[]; requirements: string[];
  sections: Section[]; createdAt: string; publishedAt?: string; featured: boolean;
  moderationNote?: string;
}
export interface Enrollment { id: string; studentId: string; courseId: string; enrolledAt: string; completedLessons: string[]; lastLessonId?: string; saved: boolean; completedAt?: string; activeMin: number }
export interface QuizAttempt { id: string; quizId: string; courseId: string; studentId: string; answers: Record<string, string>; score: number; total: number; passed: boolean; submittedAt: string; manualPending?: boolean }
export interface Submission { id: string; assignmentId: string; courseId: string; studentId: string; content: string; fileName?: string; submittedAt: string; grade?: number; feedback?: string; status: "submitted" | "graded" }
export interface Review { id: string; courseId: string; studentId: string; rating: number; comment: string; createdAt: string }
export interface Certificate { id: string; code: string; studentId: string; courseId: string; issuedAt: string; revoked?: boolean; revokeReason?: string }
export interface Subscription { id: string; studentId: string; plan: "premium"; status: "active" | "expired" | "failed" | "cancelled"; startedAt: string; expiresAt: string; paymentId?: string }
export interface Plan { id: string; name: string; priceKES: number; intervalDays: number }
export interface Payment {
  id: string; studentId: string; amount: number; currency: "KES"; provider: "mpesa";
  status: "pending" | "completed" | "failed"; phone: string;
  checkoutRequestId?: string; merchantRequestId?: string; mpesaReceipt?: string;
  resultDesc?: string; createdAt: string; completedAt?: string; callbackProcessed?: boolean;
}
export interface RevenuePeriod { id: string; label: string; startsAt: string; endsAt: string; gross: number; refunds: number; fees: number; taxes: number; net: number; tutorPool: number; platformShare: number; tutorPercent: number; allocated: boolean; allocatedAt?: string }
export interface WalletTx { id: string; tutorId: string; type: "earning" | "withdrawal" | "adjustment"; amount: number; note: string; createdAt: string; periodId?: string }
export interface Withdrawal { id: string; tutorId: string; amount: number; method: "mpesa" | "bank"; account: string; status: "pending" | "approved" | "rejected" | "paid"; createdAt: string; decidedBy?: string; payoutRef?: string; note?: string; idempotencyKey: string }
export interface Notification { id: string; userId: string; title: string; body: string; createdAt: string; read: boolean; href?: string }
export interface Discussion { id: string; courseId: string; authorId: string; title: string; body: string; createdAt: string; pinned?: boolean }
export interface Reply { id: string; discussionId: string; authorId: string; body: string; createdAt: string }
export interface Message { id: string; fromId: string; toId: string; body: string; createdAt: string; read: boolean }
export interface Report { id: string; reporterId: string; targetType: string; targetId: string; reason: string; status: "open" | "resolved" | "dismissed"; createdAt: string }
export interface VerificationRecord { id: string; userId: string; role: Role; from: AccountStatus; to: AccountStatus; decidedBy: string; reason: string; createdAt: string }
export interface AuditLog { id: string; actorId: string; action: string; target: string; reason?: string; createdAt: string }
export interface Announcement { id: string; authorId: string; audience: string; title: string; body: string; createdAt: string }
export interface Goal { id: string; studentId: string; title: string; targetHoursPerWeek: number; createdAt: string; done: boolean }
export interface Settings {
  platformName: string; tagline: string; premiumPriceKES: number; tutorPercent: number;
  minWithdrawalKES: number; certificateMinProgress: number; certificateMinQuiz: number;
  supportEmail: string; supportPhone: string; paymentMethods: string[];
  renewReminderDays: number;
}
export interface DB {
  users: User[]; courses: Course[]; quizzes: Quiz[]; assignments: Assignment[];
  enrollments: Enrollment[]; quizAttempts: QuizAttempt[]; submissions: Submission[];
  reviews: Review[]; certificates: Certificate[]; subscriptions: Subscription[];
  plans: Plan[]; payments: Payment[]; revenuePeriods: RevenuePeriod[];
  walletTxs: WalletTx[]; withdrawals: Withdrawal[]; notifications: Notification[];
  discussions: Discussion[]; replies: Reply[]; messages: Message[]; reports: Report[];
  verifications: VerificationRecord[]; auditLogs: AuditLog[]; announcements: Announcement[];
  goals: Goal[]; settings: Settings;
  meta: { ownerInitialised: boolean; setupSecretUsed: boolean; sessionSeed: string; seededAt: string; contentVersion?: number };
}

/* ---------------- Storage ----------------
 * Production on Vercel cannot write to the project directory: its
 * filesystem is read-only outside the OS temp directory. Writing to
 * ./data/edvora.json therefore throws EACCES/EROFS in production and
 * every mutating API route returns a generic 500.
 *
 * Storage is now resolved in this order:
 *   1. Supabase/Postgres when SUPABASE_DATABASE_URL (or DATABASE_URL)
 *      is set — use Supabase's *transaction pooler* connection string
 *      (port 6543) for this serverless app. The full application state
 *      is kept in one JSONB row (`edvora_private.edvora_app_state`, created
 *      automatically) so accounts survive cold starts and are shared
 *      across function instances.
 *   2. A writable JSON file for local development (./data/edvora.json),
 *      falling back to the OS temp directory when the project directory
 *      is not writable (e.g. Vercel without a database URL).
 *   3. In-memory only, as a last resort, so a storage problem degrades
 *      gracefully instead of crashing requests.
 * `persist()` never throws.
 */
const DATABASE_URL = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || "";
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const PROJECT_DATA_DIR = path.join(process.cwd(), "data");
const FALLBACK_DATA_DIR = path.join(os.tmpdir(), "edvora-data");
let activeDataDir = process.env.EDVORA_DATA_DIR || (IS_SERVERLESS ? FALLBACK_DATA_DIR : PROJECT_DATA_DIR);
const fileFor = (dir: string) => path.join(dir, "edvora.json");
let cache: DB | null = null;
let loading: Promise<DB> | null = null;
let cacheLoadedAt = 0;
let storageMode: "postgres" | "file" | "memory" = DATABASE_URL ? "postgres" : "file";
let pgPool: Pool | null = null;
let pgTableReady: Promise<void> | null = null;
const POSTGRES_CACHE_TTL_MS = 2000;
const EPHEMERAL_SECRET = crypto.randomBytes(32).toString("hex");

function candidateDirs(): string[] {
  return [...new Set([activeDataDir, FALLBACK_DATA_DIR, PROJECT_DATA_DIR])];
}
function loadFromFile(): DB | null {
  for (const dir of candidateDirs()) {
    const file = fileFor(dir);
    try {
      if (fs.existsSync(file)) {
        const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as DB;
        activeDataDir = dir;
        return parsed;
      }
    } catch (e) {
      console.error(`EDVORA: could not read data file ${file}; trying next location.`, e);
    }
  }
  return null;
}
function saveToFile(db: DB): boolean {
  let lastError: unknown = null;
  for (const dir of candidateDirs()) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fileFor(dir), JSON.stringify(db, null, 1));
      activeDataDir = dir;
      if (storageMode !== "postgres") storageMode = "file";
      return true;
    } catch (e) {
      lastError = e;
    }
  }
  storageMode = "memory";
  console.error("EDVORA: no writable data directory available; continuing in memory only.", lastError);
  return false;
}
function getPool(): Pool {
  if (!pgPool) {
    const needsSsl = DATABASE_URL.includes("supabase.co") || DATABASE_URL.includes("sslmode=require");
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      max: 1,
      idleTimeoutMillis: 10000,
    });
    pgPool.on("error", (e) => console.error("EDVORA: idle Postgres client error.", e));
  }
  return pgPool;
}
async function loadFromPostgres(): Promise<DB> {
  const pool = getPool();
  if (!pgTableReady) {
    pgTableReady = (async () => {
      // Private schema on purpose: the state row contains password
      // hashes and must never be reachable through Supabase's public
      // Data API. RLS is enabled as a second line of defence; the
      // direct pooler connection (table owner) is unaffected.
      await pool.query("CREATE SCHEMA IF NOT EXISTS edvora_private");
      await pool.query(`CREATE TABLE IF NOT EXISTS edvora_private.edvora_app_state (
        id smallint PRIMARY KEY,
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
      await pool.query("ALTER TABLE edvora_private.edvora_app_state ENABLE ROW LEVEL SECURITY");
    })();
  }
  await pgTableReady;
  const result = await pool.query("SELECT data FROM edvora_private.edvora_app_state WHERE id = 1");
  const row = result.rows[0] as { data: DB | string } | undefined;
  if (row?.data) return typeof row.data === "string" ? (JSON.parse(row.data) as DB) : row.data;
  const seeded = seed();
  await pool.query("INSERT INTO edvora_private.edvora_app_state (id, data) VALUES (1, $1) ON CONFLICT (id) DO NOTHING", [JSON.stringify(seeded)]);
  // Another cold-starting instance may have won the seed race; prefer
  // the row that is actually stored so every instance agrees.
  const winner = await pool.query("SELECT data FROM edvora_private.edvora_app_state WHERE id = 1");
  const winnerRow = winner.rows[0] as { data: DB | string } | undefined;
  if (winnerRow?.data) return typeof winnerRow.data === "string" ? (JSON.parse(winnerRow.data) as DB) : winnerRow.data;
  return seeded;
}
async function saveToPostgres(db: DB): Promise<void> {
  await getPool().query(
    "INSERT INTO edvora_private.edvora_app_state (id, data, updated_at) VALUES (1, $1, now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()",
    [JSON.stringify(db)]
  );
}

export const uid = (p = "") => p + crypto.randomBytes(6).toString("hex");
export const now = () => new Date().toISOString();
export function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${h}`;
}
export function verifyPassword(pw: string, stored: string) {
  const [salt, h] = stored.split(":");
  if (!salt || !h) return false;
  const test = crypto.scryptSync(pw, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(h, "hex"), test);
}

export async function getDB(): Promise<DB> {
  if (cache && (storageMode !== "postgres" || Date.now() - cacheLoadedAt < POSTGRES_CACHE_TTL_MS)) return cache;
  if (loading) return loading;
  loading = (async (): Promise<DB> => {
    if (DATABASE_URL) {
      try {
        const loaded = await loadFromPostgres();
        const migrated = applyContentMigrations(loaded);
        cache = loaded;
        storageMode = "postgres";
        cacheLoadedAt = Date.now();
        if (migrated) await persist();
        return cache;
      } catch (e) {
        // Never take the whole app down because the database URL is
        // wrong or unreachable: log loudly and fall back to file/temp
        // storage so the deployment keeps working while it is fixed.
        console.error("EDVORA: Postgres storage failed (check SUPABASE_DATABASE_URL — it should be the Supabase transaction pooler, port 6543). Falling back to file storage.", e);
        storageMode = "file";
        if (cache) return cache;
      }
    }
    const existing = loadFromFile();
    if (existing) {
      const migrated = applyContentMigrations(existing);
      cache = existing;
      cacheLoadedAt = Date.now();
      if (migrated) saveToFile(cache);
      return cache;
    }
    cache = seed();
    cacheLoadedAt = Date.now();
    saveToFile(cache);
    return cache;
  })();
  try {
    return await loading;
  } finally {
    loading = null;
  }
}
/** Idempotent content packs: merges new catalogue content into existing
 *  deployments without disturbing users, enrolments or finances.
 *  Returns true when the state changed and should be persisted. */
function applyContentMigrations(db: DB): boolean {
  if ((db.meta.contentVersion ?? 1) >= 3) return false;
  const upsert = <T extends { id: string }>(list: T[], items: T[]) => {
    for (const item of items) {
      const i = list.findIndex((x) => x.id === item.id);
      if (i >= 0) list[i] = item; else list.push(item);
    }
  };
  upsert(db.courses, TUTORIAL_COURSES);
  upsert(db.quizzes, TUTORIAL_QUIZZES);
  upsert(db.assignments, TUTORIAL_ASSIGNMENTS);
  db.meta.contentVersion = 3;
  return true;
}
/** Persist the current state. Never throws: a storage failure is logged
 *  and the request continues with in-memory state rather than returning
 *  a generic 500 to the learner. */
export async function persist(): Promise<void> {
  if (!cache) return;
  if (DATABASE_URL && storageMode === "postgres") {
    try {
      await saveToPostgres(cache);
      cacheLoadedAt = Date.now();
      return;
    } catch (e) {
      console.error("EDVORA: Postgres persist failed; falling back to file storage.", e);
      storageMode = "file";
    }
  }
  saveToFile(cache);
  cacheLoadedAt = Date.now();
}
export function sessionSecret() {
  // Routes always `await getDB()` before signing/verifying, so the
  // cache (and its persisted fallback seed) is available here. On
  // serverless, set SESSION_SECRET so sessions survive every instance.
  return process.env.SESSION_SECRET || cache?.meta.sessionSeed || EPHEMERAL_SECRET;
}
export function audit(actorId: string, action: string, target: string, reason?: string) {
  if (!cache) return;
  cache.auditLogs.unshift({ id: uid("al_"), actorId, action, target, reason, createdAt: now() });
}
export function notify(userId: string, title: string, body: string, href?: string) {
  if (!cache) return;
  cache.notifications.unshift({ id: uid("n_"), userId, title, body, createdAt: now(), read: false, href });
}
export function publicUser(u: User) {
  const { passwordHash, ...rest } = u; void passwordHash; return rest;
}
export function courseLessons(c: Course) { return c.sections.flatMap((s) => s.lessons); }
export function courseDurationMin(c: Course) { return courseLessons(c).reduce((a, l) => a + l.durationMin, 0); }
export function isPremiumActive(db: DB, u: User) {
  if (u.plan !== "premium") return false;
  const sub = db.subscriptions.find((s) => s.id === u.subscriptionId);
  if (!sub) return false;
  return sub.status === "active" && new Date(sub.expiresAt).getTime() > Date.now();
}
export function canAccessCourse(db: DB, u: User | null, c: Course) {
  if (c.access === "free") return true;
  if (!u) return false;
  if (u.role === "owner" || u.role === "administrator") return true;
  if (u.role === "tutor" && c.tutorId === u.id) return true;
  return isPremiumActive(db, u);
}

/* ---------------- Seed ---------------- */
const IMG = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=70`;
function lessons(prefix: string, items: [string, number, string][], previewFirst = true): Lesson[] {
  return items.map(([title, durationMin, body], i) => ({
    id: `${prefix}-l${i + 1}`, title, kind: i % 3 === 2 ? "reading" : "video", durationMin,
    isPreview: previewFirst && i === 0, body,
    videoUrl: i % 3 === 2 ? undefined : "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
  }));
}
function mkCourse(o: Partial<Course> & { outline: [string, [string, number, string][]][] }): Course {
  const sections: Section[] = o.outline.map(([t, ls], i) => ({ id: `${o.id}-s${i + 1}`, title: t, lessons: lessons(`${o.id}-s${i + 1}`, ls) }));
  return {
    id: o.id!, slug: o.id!, title: o.title!, subtitle: o.subtitle || "", description: o.description || "",
    category: o.category!, level: o.level || "Beginner", access: o.access || "free",
    tutorId: o.tutorId!, status: o.status || "published", image: o.image!,
    objectives: o.objectives || [], requirements: o.requirements || [], sections,
    createdAt: o.createdAt || now(), publishedAt: o.publishedAt || now(), featured: !!o.featured,
  };
}

function seed(): DB {
  const pw = (s: string) => hashPassword(s);
  const base = { contactVerified: true, notificationPrefs: { email: true, inApp: true }, createdAt: "2026-06-01T08:00:00.000Z" };
  const users: User[] = [
    { ...base, id: "u_admin1", fullName: "Grace Wanjiru", email: "admin@edvora.ac.ke", phone: "+254700000010", passwordHash: pw("Admin@2026"), role: "administrator", status: "verified", avatarColor: "#4f46e5", plan: "free", title: "Platform Operations Lead" },
    { ...base, id: "u_admin_pending", fullName: "Brian Kiprop", email: "brian.kiprop@example.co.ke", phone: "+254700000011", passwordHash: pw("Brian@2026"), role: "administrator", status: "pending", avatarColor: "#0ea5e9", plan: "free", title: "Operations Assistant (invited)" },
    { ...base, id: "u_tutor1", fullName: "Dr. Amina Odhiambo", email: "amina@edvora.ac.ke", phone: "+254700000020", passwordHash: pw("Teach@2026"), role: "tutor", status: "verified", avatarColor: "#2563eb", plan: "free", title: "Senior Tutor, Computer Science", expertise: "Software Engineering & Web Development", qualifications: "PhD Computer Science, University of Nairobi", experience: "12 years university teaching", bio: "Dr Amina Odhiambo leads software engineering programmes and has mentored hundreds of engineers across East Africa.", payoutMethod: "mpesa", payoutAccount: "+254700000020" },
    { ...base, id: "u_tutor2", fullName: "Peter Mwangi", email: "peter@edvora.ac.ke", phone: "+254700000021", passwordHash: pw("Teach@2026"), role: "tutor", status: "verified", avatarColor: "#7c3aed", plan: "free", title: "Data Science Consultant", expertise: "Data Analytics & Machine Learning", qualifications: "MSc Data Science", experience: "8 years industry + training", bio: "Peter Mwangi helps Kenyan businesses turn messy data into decisions, and teaches the exact workflows he uses with clients.", payoutMethod: "bank", payoutAccount: "KCB •••• 4412" },
    { ...base, id: "u_tutor3", fullName: "Mary Njeri", email: "mary@edvora.ac.ke", phone: "+254700000022", passwordHash: pw("Teach@2026"), role: "tutor", status: "verified", avatarColor: "#0891b2", plan: "free", title: "Chartered Accountant (CPA-K)", expertise: "Business, Finance & Accounting", qualifications: "CPA-K, BCom Finance", experience: "10 years practice and tutoring", bio: "Mary Njeri makes finance practical — from bookkeeping for SMEs to investment fundamentals for beginners.", payoutMethod: "mpesa", payoutAccount: "+254700000022" },
    { ...base, id: "u_tutor_pending", fullName: "Kevin Omondi", email: "kevin.omondi@example.co.ke", phone: "+254700000023", passwordHash: pw("Kevin@2026"), role: "tutor", status: "pending", avatarColor: "#db2777", plan: "free", title: "Digital Marketing Specialist", expertise: "Digital Marketing", qualifications: "BBA Marketing, Google Digital Marketing Certificate", experience: "6 years agency work in Nairobi", bio: "I help local brands grow online with small budgets and measurable campaigns.", proposedCourses: "Social Media Marketing for Kenyan SMEs; Content Strategy Basics" },
    { ...base, id: "u_student_free", fullName: "Faith Chebet", email: "faith@example.co.ke", phone: "+254700000030", passwordHash: pw("Learn@2026"), role: "student", status: "verified", avatarColor: "#059669", plan: "free" },
    { ...base, id: "u_student_pro", fullName: "David Otieno", email: "david@example.co.ke", phone: "+254700000031", passwordHash: pw("Learn@2026"), role: "student", status: "verified", avatarColor: "#d97706", plan: "premium", subscriptionId: "sub_demo1" },
    { ...base, id: "u_student3", fullName: "Zawadi Muthoni", email: "zawadi@example.co.ke", phone: "+254700000032", passwordHash: pw("Learn@2026"), role: "student", status: "verified", avatarColor: "#9333ea", plan: "premium", subscriptionId: "sub_demo2" },
    { ...base, id: "u_student4", fullName: "Samuel Kariuki", email: "samuel@example.co.ke", phone: "+254700000033", passwordHash: pw("Learn@2026"), role: "student", status: "verified", avatarColor: "#0369a1", plan: "free" },
  ];

  const courses: Course[] = [
    mkCourse({
      id: "web-foundations", title: "Web Development Foundations", subtitle: "HTML, CSS and JavaScript — from zero to your first deployed site",
      description: "A complete, project-based introduction to building for the web. You will structure pages with semantic HTML, style them with modern CSS, add interactivity with JavaScript, and deploy a real portfolio site.",
      category: "Technology", level: "Beginner", access: "free", tutorId: "u_tutor1", featured: true,
      image: IMG("photo-1498050108023-c5249f4df085"),
      objectives: ["Build semantic, accessible web pages", "Style responsive layouts with Flexbox and Grid", "Add interactivity with vanilla JavaScript", "Deploy a website and share it publicly"],
      requirements: ["A computer with a browser", "No prior coding experience needed"],
      outline: [
        ["Getting Started", [
          ["How the Web Works", 12, "Browsers, servers, DNS and HTTP explained with a Kenyan lens — what really happens when you open a website in Nairobi or Kisumu."],
          ["Your First HTML Page", 18, "Create, save and open your first HTML document. Headings, paragraphs, links and images."],
          ["Semantic Structure & Accessibility", 15, "Header, nav, main, section, footer — and why screen-reader friendly markup matters for every learner."]]],
        ["Styling with CSS", [
          ["CSS Fundamentals", 20, "Selectors, the cascade, colours, typography and spacing systems."],
          ["Flexbox & Grid Layouts", 26, "Build navbars, card grids and full page layouts that adapt to any screen."],
          ["Responsive Design Project", 24, "Mobile-first design for the devices most Kenyans actually use."]]],
        ["JavaScript Essentials", [
          ["Variables, Functions & DOM", 28, "Make pages respond: click handlers, forms and dynamic content."],
          ["Build & Deploy Your Portfolio", 30, "Bring it together and publish your portfolio for the world to see."]]],
      ],
    }),
    mkCourse({
      id: "python-data", title: "Python for Data Analysis", subtitle: "Pandas, visualisation and real Kenyan datasets",
      description: "Learn Python by analysing real data: clean messy spreadsheets with pandas, visualise trends, and present insights the way employers expect. Includes downloadable datasets and graded projects.",
      category: "Data Science", level: "Intermediate", access: "premium", tutorId: "u_tutor2", featured: true,
      image: IMG("photo-1551288049-bebda4e38f71"),
      objectives: ["Clean and reshape data with pandas", "Create publication-quality charts", "Answer business questions with data", "Build a portfolio-ready analysis project"],
      requirements: ["Basic computer skills", "No Python experience required — we start gently"],
      outline: [
        ["Python Kickstart", [
          ["Setting Up & Python Basics", 16, "Install tools, run notebooks, variables, lists and loops."],
          ["Working with Files & CSVs", 18, "Read real-world CSV exports the way they actually arrive — messy."]]],
        ["Pandas in Practice", [
          ["DataFrames & Cleaning", 30, "Missing values, duplicates, types and dates."],
          ["Grouping, Joins & Pivots", 28, "Answer questions across multiple tables."],
          ["Visualising Insights", 24, "Charts that convince: trends, comparisons and distributions."]]],
        ["Capstone", [
          ["Capstone: County Data Story", 35, "Analyse an open Kenyan dataset end-to-end and present your findings."]]],
      ],
    }),
    mkCourse({
      id: "business-finance", title: "Business Finance Essentials", subtitle: "Bookkeeping, cashflow and smart money decisions for SMEs",
      description: "Practical finance for founders and professionals: record-keeping that satisfies KRA, reading financial statements, managing cashflow, pricing for profit and planning taxes without panic.",
      category: "Business", level: "Beginner", access: "premium", tutorId: "u_tutor3", featured: true,
      image: IMG("photo-1554224155-6726b3ff858f"),
      objectives: ["Keep clean books from day one", "Read income statements and balance sheets", "Forecast and protect cashflow", "Understand Kenyan tax obligations for SMEs"],
      requirements: ["Basic numeracy", "A notebook or spreadsheet app"],
      outline: [
        ["Foundations", [
          ["Money In, Money Out: Bookkeeping Basics", 14, "The simple system that keeps your business audit-ready."],
          ["Reading Financial Statements", 22, "Income statement, balance sheet and cashflow — decoded."]]],
        ["Running the Numbers", [
          ["Cashflow Forecasting", 20, "Never be surprised by a quiet month again."],
          ["Pricing for Profit", 18, "Margins, markups and break-even, with worked examples."],
          ["Taxes for Kenyan SMEs", 21, "PIN, VAT, turnover tax and filing calendars explained."]]],
      ],
    }),
    mkCourse({
      id: "KCSE-maths", title: "Mathematics Masterclass: Secondary Level", subtitle: "Algebra, geometry and exam technique for KCSE success",
      description: "Step-by-step mastery of the secondary mathematics syllabus with hundreds of worked examples, timed practice and proven exam technique.",
      category: "Academic", level: "All levels", access: "free", tutorId: "u_tutor1", featured: false,
      image: IMG("photo-1509228468518-180dd4864904"),
      objectives: ["Master algebra and equations", "Solve geometry problems confidently", "Improve speed with exam technique"],
      requirements: ["Secondary school enrolment or revision goal"],
      outline: [
        ["Algebra", [
          ["Expressions & Equations", 20, "Simplify, expand, factorise and solve — fluently."],
          ["Quadratic Equations", 22, "Three methods, one goal: never fear a quadratic again."]]],
        ["Geometry & Trigonometry", [
          ["Angles, Triangles & Circles", 24, "Theorems made visual and memorable."],
          ["Trigonometry in Practice", 20, "SOHCAHTOA and real-world problems."]]],
      ],
    }),
    mkCourse({
      id: "digital-marketing", title: "Digital Marketing for Growth", subtitle: "Social media, content and ads that work on a Kenyan budget",
      description: "Grow a brand with limited resources: audience research, content systems for TikTok/Instagram/WhatsApp Business, and measuring what actually sells.",
      category: "Business", level: "Beginner", access: "free", tutorId: "u_tutor2", featured: false,
      image: IMG("photo-1460925895917-afdab827c52f"),
      objectives: ["Define and research your audience", "Plan a month of content in a day", "Run small, measurable ad tests"],
      requirements: ["A smartphone", "A business or brand idea"],
      outline: [
        ["Strategy First", [
          ["Knowing Your Customer", 15, "Personas grounded in real conversations, not guesses."],
          ["Content Systems", 19, "Batch-create content that sells without burning out."]]],
        ["Channels", [
          ["WhatsApp Business & Social Selling", 17, "Catalogues, broadcasts and follow-up etiquette."],
          ["Measuring Results", 16, "The five numbers that matter weekly."]]],
      ],
    }),
    mkCourse({
      id: "ml-intro", title: "Introduction to Machine Learning", subtitle: "Models, evaluation and responsible AI — hands on",
      description: "A rigorous but friendly entry into ML: regression, classification, train/test discipline, and the ethics of deploying models that affect real people.",
      category: "Data Science", level: "Advanced", access: "premium", tutorId: "u_tutor2", featured: false,
      image: IMG("photo-1555255707-c07966088b7b"),
      objectives: ["Train and evaluate ML models", "Avoid leakage and overfitting", "Communicate model results honestly"],
      requirements: ["Python basics", "Comfort with basic statistics"],
      outline: [
        ["Core Ideas", [
          ["What Machine Learning Really Is", 18, "Supervised vs unsupervised, features and labels."],
          ["Regression & Classification", 26, "Your first models with scikit-learn."]]],
        ["Doing It Right", [
          ["Evaluation & Cross-Validation", 24, "Metrics that match the mission."],
          ["Responsible AI", 20, "Bias, fairness and Kenyan data protection law."]]],
      ],
    }),
    mkCourse({
      id: "ui-design", title: "UI Design with Figma", subtitle: "From wireframes to polished, developer-ready interfaces",
      description: "Design modern interfaces in Figma: layout, type, colour systems, components and prototyping — taught through a complete mobile app project.",
      category: "Design", level: "Beginner", access: "premium", tutorId: "u_tutor1", featured: false, status: "in_review",
      image: IMG("photo-1561070791-2526d30994b5"),
      objectives: ["Design responsive screens in Figma", "Build a reusable component library", "Prototype and hand off to developers"],
      requirements: ["A free Figma account"],
      outline: [
        ["Design Foundations", [
          ["Layout, Type & Colour", 21, "The 80/20 of interfaces that look professional."],
          ["Components & Auto-Layout", 25, "Work like a product designer, not a decorator."]]],
      ],
    }),
    mkCourse({
      id: "english-communication", title: "Professional English & Communication", subtitle: "Write, present and interview with confidence",
      description: "Upgrade your professional communication: clear business writing, presentations that land, and interview skills for local and remote roles.",
      category: "Academic", level: "All levels", access: "free", tutorId: "u_tutor3", featured: false, status: "draft",
      image: IMG("photo-1455390582262-044cdead277a"),
      objectives: ["Write clear professional emails", "Present ideas with structure", "Prepare for interviews"],
      requirements: ["Intermediate English"],
      outline: [
        ["Writing", [
          ["Emails That Get Replies", 14, "Subject lines, structure and tone."]]],
      ],
    }),
  ];

  const quizzes: Quiz[] = [
    { id: "q_web1", courseId: "web-foundations", title: "HTML & CSS Check", timeLimitMin: 10, maxAttempts: 3, passMark: 60, questions: [
      { id: "qq1", type: "mcq", prompt: "Which element defines the main content of a page for assistive technology?", options: ["<div>", "<main>", "<span>", "<body>"], answer: "<main>", explanation: "<main> marks the primary content landmark." },
      { id: "qq2", type: "tf", prompt: "Flexbox lays items out in one dimension (a row OR a column).", options: ["True", "False"], answer: "True", explanation: "Flexbox is one-dimensional; Grid is two-dimensional." },
      { id: "qq3", type: "mcq", prompt: "Which CSS property creates space INSIDE an element's border?", options: ["margin", "padding", "gap", "outline"], answer: "padding", explanation: "Padding is inner space; margin is outer space." },
      { id: "qq4", type: "short", prompt: "In one or two sentences: why is mobile-first design important in Kenya?", answer: "", explanation: "Most Kenyan users access the web primarily via mobile phones, often on slower connections." },
    ]},
    { id: "q_py1", courseId: "python-data", title: "Pandas Fundamentals", timeLimitMin: 12, maxAttempts: 3, passMark: 60, questions: [
      { id: "pq1", type: "mcq", prompt: "Which pandas method removes rows with missing values?", options: ["dropna()", "fillna()", "merge()", "pivot()"], answer: "dropna()", explanation: "dropna() removes missing values." },
      { id: "pq2", type: "tf", prompt: "A DataFrame can hold columns of different data types.", options: ["True", "False"], answer: "True", explanation: "Each column is a Series with its own dtype." },
      { id: "pq3", type: "mcq", prompt: "groupby() is mainly used to…", options: ["sort rows alphabetically", "aggregate data by categories", "delete duplicates", "read CSV files"], answer: "aggregate data by categories", explanation: "groupby splits, applies a function, and combines results." },
    ]},
    { id: "q_fin1", courseId: "business-finance", title: "Cashflow Basics", timeLimitMin: 8, maxAttempts: 3, passMark: 60, questions: [
      { id: "fq1", type: "mcq", prompt: "A business can be profitable on paper yet fail because of…", options: ["too many customers", "poor cashflow timing", "low rent", "good records"], answer: "poor cashflow timing", explanation: "Profit ≠ cash. Timing of receipts vs payments matters." },
      { id: "fq2", type: "tf", prompt: "The balance sheet shows what a business owns and owes at a point in time.", options: ["True", "False"], answer: "True", explanation: "Assets = Liabilities + Equity at a specific date." },
    ]},
  ];
  const assignments: Assignment[] = [
    { id: "a_web1", courseId: "web-foundations", title: "Build Your Landing Page", instructions: "Create a one-page website for a real or imagined Kenyan business. Include a hero, services section, contact area and responsive layout. Paste your deployed link or describe your project structure.", dueDate: "2026-11-20", maxScore: 100 },
    { id: "a_py1", courseId: "python-data", title: "Clean a Messy Dataset", instructions: "Download the practice CSV from the lesson resources, clean it with pandas, and summarise three insights you found, with the code you used.", dueDate: "2026-11-25", maxScore: 100 },
  ];

  const wf = courses[0]; const py = courses[1];
  const enrollments: Enrollment[] = [
    { id: "e1", studentId: "u_student_free", courseId: "web-foundations", enrolledAt: "2026-09-02T10:00:00.000Z", completedLessons: [wf.sections[0].lessons[0].id, wf.sections[0].lessons[1].id], lastLessonId: wf.sections[0].lessons[2].id, saved: false, activeMin: 47 },
    { id: "e2", studentId: "u_student_pro", courseId: "web-foundations", enrolledAt: "2026-08-15T10:00:00.000Z", completedLessons: courseLessons(wf).map((l) => l.id), saved: false, completedAt: "2026-10-01T10:00:00.000Z", activeMin: 210 },
    { id: "e3", studentId: "u_student_pro", courseId: "python-data", enrolledAt: "2026-10-03T10:00:00.000Z", completedLessons: [py.sections[0].lessons[0].id, py.sections[0].lessons[1].id, py.sections[1].lessons[0].id], lastLessonId: py.sections[1].lessons[1].id, saved: false, activeMin: 96 },
    { id: "e4", studentId: "u_student3", courseId: "python-data", enrolledAt: "2026-10-05T10:00:00.000Z", completedLessons: [py.sections[0].lessons[0].id], saved: false, activeMin: 22 },
    { id: "e5", studentId: "u_student3", courseId: "business-finance", enrolledAt: "2026-10-06T10:00:00.000Z", completedLessons: [], saved: true, activeMin: 5 },
    { id: "e6", studentId: "u_student4", courseId: "KCSE-maths", enrolledAt: "2026-10-10T10:00:00.000Z", completedLessons: [], saved: false, activeMin: 12 },
    { id: "e7", studentId: "u_student_free", courseId: "digital-marketing", enrolledAt: "2026-10-12T10:00:00.000Z", completedLessons: [], saved: true, activeMin: 3 },
  ];
  const quizAttempts: QuizAttempt[] = [
    { id: "qa1", quizId: "q_web1", courseId: "web-foundations", studentId: "u_student_pro", answers: { qq1: "<main>", qq2: "True", qq3: "padding", qq4: "Most users are on phones." }, score: 3, total: 3, passed: true, submittedAt: "2026-09-28T10:00:00.000Z" },
  ];
  const submissions: Submission[] = [
    { id: "s1", assignmentId: "a_web1", courseId: "web-foundations", studentId: "u_student_pro", content: "Deployed my bakery landing page with a responsive menu and WhatsApp order button. Link included in my notes.", submittedAt: "2026-09-30T10:00:00.000Z", grade: 88, feedback: "Strong layout and clear call-to-action. Watch colour contrast on the hero text.", status: "graded" },
    { id: "s2", assignmentId: "a_py1", courseId: "python-data", studentId: "u_student_pro", content: "Cleaned 1,240 rows: dropped 38 duplicates, fixed date parsing, filled missing county names from a lookup. Insights attached in summary.", submittedAt: "2026-10-18T10:00:00.000Z", status: "submitted" },
  ];
  const reviews: Review[] = [
    { id: "r1", courseId: "web-foundations", studentId: "u_student_pro", rating: 5, comment: "Clear, paced well, and the projects forced me to actually build. Best beginner course I have taken.", createdAt: "2026-10-02T10:00:00.000Z" },
    { id: "r2", courseId: "python-data", studentId: "u_student3", rating: 5, comment: "The Kenyan datasets make everything click. Peter explains joins better than anyone.", createdAt: "2026-10-09T10:00:00.000Z" },
    { id: "r3", courseId: "web-foundations", studentId: "u_student_free", rating: 4, comment: "Great so far — would love more downloadable notes.", createdAt: "2026-09-20T10:00:00.000Z" },
  ];
  const certificates: Certificate[] = [
    { id: "c1", code: "EDV-2026-WF8K2D", studentId: "u_student_pro", courseId: "web-foundations", issuedAt: "2026-10-01T10:05:00.000Z" },
  ];
  const subscriptions: Subscription[] = [
    { id: "sub_demo1", studentId: "u_student_pro", plan: "premium", status: "active", startedAt: "2026-10-05T10:00:00.000Z", expiresAt: "2026-11-25T10:00:00.000Z", paymentId: "pay_demo1" },
    { id: "sub_demo2", studentId: "u_student3", plan: "premium", status: "active", startedAt: "2026-10-04T10:00:00.000Z", expiresAt: "2026-11-20T10:00:00.000Z", paymentId: "pay_demo2" },
  ];
  const payments: Payment[] = [
    { id: "pay_demo1", studentId: "u_student_pro", amount: 499, currency: "KES", provider: "mpesa", status: "completed", phone: "+254700000031", mpesaReceipt: "QK7X2M9P4R", createdAt: "2026-10-05T09:58:00.000Z", completedAt: "2026-10-05T10:00:00.000Z", callbackProcessed: true },
    { id: "pay_demo2", studentId: "u_student3", amount: 499, currency: "KES", provider: "mpesa", status: "completed", phone: "+254700000032", mpesaReceipt: "QK7X2M9P5S", createdAt: "2026-10-04T09:58:00.000Z", completedAt: "2026-10-04T10:00:00.000Z", callbackProcessed: true },
    { id: "pay_demo3", studentId: "u_student_free", amount: 499, currency: "KES", provider: "mpesa", status: "failed", phone: "+254700000030", resultDesc: "Request cancelled by user", createdAt: "2026-10-15T09:58:00.000Z", callbackProcessed: true },
  ];
  const revenuePeriods: RevenuePeriod[] = [
    { id: "rp_sep2026", label: "September 2026", startsAt: "2026-09-01", endsAt: "2026-09-30", gross: 99750, refunds: 499, fees: 1496, taxes: 0, net: 97755, tutorPool: 78204, platformShare: 19551, tutorPercent: 80, allocated: true, allocatedAt: "2026-10-03T10:00:00.000Z" },
    { id: "rp_oct2026", label: "October 2026", startsAt: "2026-10-01", endsAt: "2026-10-31", gross: 0, refunds: 0, fees: 0, taxes: 0, net: 0, tutorPool: 0, platformShare: 0, tutorPercent: 80, allocated: false },
  ];
  const walletTxs: WalletTx[] = [
    { id: "w1", tutorId: "u_tutor1", type: "earning", amount: 31280, note: "September 2026 allocation — Web Development Foundations engagement", createdAt: "2026-10-03T10:00:00.000Z", periodId: "rp_sep2026" },
    { id: "w2", tutorId: "u_tutor2", type: "earning", amount: 28150, note: "September 2026 allocation — Python for Data Analysis engagement", createdAt: "2026-10-03T10:00:00.000Z", periodId: "rp_sep2026" },
    { id: "w3", tutorId: "u_tutor3", type: "earning", amount: 18774, note: "September 2026 allocation — Business Finance Essentials engagement", createdAt: "2026-10-03T10:00:00.000Z", periodId: "rp_sep2026" },
    { id: "w4", tutorId: "u_tutor1", type: "withdrawal", amount: -15000, note: "M-Pesa payout QK8PAID001", createdAt: "2026-10-10T10:00:00.000Z" },
  ];
  const withdrawals: Withdrawal[] = [
    { id: "wd1", tutorId: "u_tutor1", amount: 15000, method: "mpesa", account: "+254700000020", status: "paid", createdAt: "2026-10-08T10:00:00.000Z", decidedBy: "u_admin1", payoutRef: "QK8PAID001", idempotencyKey: "wd1-key" },
    { id: "wd2", tutorId: "u_tutor2", amount: 20000, method: "bank", account: "KCB •••• 4412", status: "pending", createdAt: "2026-10-28T10:00:00.000Z", idempotencyKey: "wd2-key" },
  ];
  const discussions: Discussion[] = [
    { id: "d1", courseId: "web-foundations", authorId: "u_tutor1", title: "Welcome — introduce yourself", body: "Karibu! Tell us where you are learning from and what you want to build first.", createdAt: "2026-09-01T10:00:00.000Z", pinned: true },
    { id: "d2", courseId: "web-foundations", authorId: "u_student_free", title: "Flexbox centring trick?", body: "I keep forgetting how to centre a div both ways. Any memorable rule?", createdAt: "2026-09-21T10:00:00.000Z" },
    { id: "d3", courseId: "python-data", authorId: "u_student3", title: "County dataset sources", body: "Where do you find clean county-level open data for practice?", createdAt: "2026-10-11T10:00:00.000Z" },
  ];
  const replies: Reply[] = [
    { id: "rp1", discussionId: "d2", authorId: "u_tutor1", body: "display:flex; align-items:center; justify-content:center — think 'align across, justify along'.", createdAt: "2026-09-21T12:00:00.000Z" },
    { id: "rp2", discussionId: "d1", authorId: "u_student_pro", body: "David from Nakuru — building a site for my sister's bakery.", createdAt: "2026-09-03T12:00:00.000Z" },
  ];
  const messages: Message[] = [
    { id: "m1", fromId: "u_student_pro", toId: "u_tutor2", body: "Hi Peter, my capstone dataset has duplicate county names with different spellings. Best approach?", createdAt: "2026-10-17T10:00:00.000Z", read: true },
    { id: "m2", fromId: "u_tutor2", toId: "u_student_pro", body: "Build a small mapping dictionary of variants → official name, then .replace(). We cover this in the cleaning lesson too.", createdAt: "2026-10-17T14:00:00.000Z", read: false },
  ];
  const notifications: Notification[] = [
    { id: "n1", userId: "u_student_pro", title: "Assignment graded", body: "Build Your Landing Page — 88/100. Tap to read feedback.", createdAt: "2026-10-02T10:00:00.000Z", read: false, href: "/dashboard/student/assignments" },
    { id: "n2", userId: "u_tutor2", title: "New submission to grade", body: "David Otieno submitted 'Clean a Messy Dataset'.", createdAt: "2026-10-18T10:00:00.000Z", read: false, href: "/dashboard/tutor/students" },
    { id: "n3", userId: "u_admin1", title: "Tutor application awaiting review", body: "Kevin Omondi applied to teach Digital Marketing.", createdAt: "2026-10-20T10:00:00.000Z", read: false, href: "/dashboard/admin/tutors" },
    { id: "n4", userId: "u_student_free", title: "Welcome to EDVORA", body: "Your account is verified. Start with any free course.", createdAt: "2026-09-02T10:00:00.000Z", read: true },
  ];
  const reports: Report[] = [
    { id: "rep1", reporterId: "u_student4", targetType: "discussion", targetId: "d2", reason: "Off-topic spam link was posted and removed by author — flagging for awareness.", status: "open", createdAt: "2026-10-22T10:00:00.000Z" },
  ];
  const verifications: VerificationRecord[] = [
    { id: "v1", userId: "u_tutor1", role: "tutor", from: "pending", to: "verified", decidedBy: "u_admin1", reason: "Credentials and references checked.", createdAt: "2026-06-10T10:00:00.000Z" },
    { id: "v2", userId: "u_student_free", role: "student", from: "pending", to: "verified", decidedBy: "system", reason: "Automatic verification after contact confirmation.", createdAt: "2026-09-02T10:00:00.000Z" },
  ];
  const auditLogs: AuditLog[] = [
    { id: "al1", actorId: "u_admin1", action: "tutor.verified", target: "u_tutor1", reason: "Credentials checked", createdAt: "2026-06-10T10:00:00.000Z" },
    { id: "al2", actorId: "u_admin1", action: "withdrawal.paid", target: "wd1", reason: "M-Pesa QK8PAID001", createdAt: "2026-10-10T10:00:00.000Z" },
    { id: "al3", actorId: "u_admin1", action: "course.published", target: "python-data", createdAt: "2026-08-20T10:00:00.000Z" },
  ];
  const announcements: Announcement[] = [
    { id: "an1", authorId: "u_admin1", audience: "all-students", title: "New: Python capstone datasets", body: "Fresh county-level practice datasets are now available inside Python for Data Analysis.", createdAt: "2026-10-15T10:00:00.000Z" },
  ];
  const goals: Goal[] = [
    { id: "g1", studentId: "u_student_free", title: "Finish Web Foundations section 2", targetHoursPerWeek: 4, createdAt: "2026-10-01T10:00:00.000Z", done: false },
    { id: "g2", studentId: "u_student_pro", title: "Complete Python capstone draft", targetHoursPerWeek: 6, createdAt: "2026-10-05T10:00:00.000Z", done: false },
  ];

  return {
    users,
    courses: [...courses, ...TUTORIAL_COURSES],
    quizzes: [...quizzes, ...TUTORIAL_QUIZZES],
    assignments: [...assignments, ...TUTORIAL_ASSIGNMENTS],
    enrollments, quizAttempts, submissions, reviews,
    certificates, subscriptions, plans: [{ id: "plan_premium", name: "EDVORA Premium — Monthly All-Access", priceKES: 499, intervalDays: 30 }],
    payments, revenuePeriods, walletTxs, withdrawals, notifications, discussions, replies,
    messages, reports, verifications, auditLogs, announcements, goals,
    settings: {
      platformName: "EDVORA", tagline: "LEARN BEYOND LIMITS.", premiumPriceKES: 499,
      tutorPercent: 80, minWithdrawalKES: 1000, certificateMinProgress: 100, certificateMinQuiz: 60,
      supportEmail: "edvoraplatform@gmail.com", supportPhone: "+254 110 966 455",
      paymentMethods: ["M-Pesa (Daraja STK Push)"], renewReminderDays: 5,
    },
    meta: { ownerInitialised: false, setupSecretUsed: false, sessionSeed: crypto.randomBytes(32).toString("hex"), seededAt: now(), contentVersion: 3 },
  };
}
