/**
 * DEVELOPMENT AND TEST DATA ONLY.
 *
 *   npm run db:seed
 *
 * Creates clearly labelled demonstration accounts and courses so the platform
 * can be explored locally. Every seeded email address ends in @example.test
 * and every seeded course title starts with "[Demo]".
 *
 * Safety:
 *  - refuses to run when NODE_ENV=production;
 *  - refuses to run against a database that already contains users, so it
 *    can never be mixed into real data.
 */
import "./_env";
import { count, eq } from "drizzle-orm";

const PASSWORD = process.env.SEED_PASSWORD ?? "demo-password-123";

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed: NODE_ENV is production.");
    process.exit(1);
  }
  const { db, schema } = await import("../src/server/db");
  const { provisionAccount } = await import("../src/server/services/admin");
  const { actorFromUser } = await import("./_actor");
  const courses = await import("../src/server/services/courses");
  const assessments = await import("../src/server/services/assessments");
  const assignments = await import("../src/server/services/assignments");

  const [existing] = await db.select({ n: count() }).from(schema.users);
  if ((existing?.n ?? 0) > 0) {
    console.error("Refusing to seed: this database already contains users. Seed data is only for an empty development database.");
    process.exit(1);
  }

  console.log("Seeding demonstration data ...");
  const admin = await provisionAccount(db, { name: "Demo Administrator", email: "admin@example.test", password: PASSWORD, role: "admin" });
  const teacher = await provisionAccount(db, { name: "Demo Instructor", email: "instructor@example.test", password: PASSWORD, role: "instructor" });
  await provisionAccount(db, { name: "Demo Learner", email: "learner@example.test", password: PASSWORD, role: "student" });
  await provisionAccount(db, { name: "Second Demo Learner", email: "learner2@example.test", password: PASSWORD, role: "student" });
  await db
    .update(schema.profiles)
    .set({ headline: "Demonstration instructor account", bio: "This profile belongs to seeded demonstration data." })
    .where(eq(schema.profiles.userId, teacher.id));

  const [business, technology] = await db
    .insert(schema.categories)
    .values([
      { name: "Business Skills", slug: "business-skills", description: "Practical skills for work and enterprise.", position: 1 },
      { name: "Technology", slug: "technology", description: "Digital and technical skills.", position: 2 },
    ])
    .returning();
  await db.insert(schema.tags).values([
    { name: "Beginner friendly", slug: "beginner-friendly" },
    { name: "Self-paced", slug: "self-paced" },
  ]);
  await db.insert(schema.certificateTemplates).values({
    name: "Standard",
    heading: "Certificate of Completion",
    body: "This certifies that {{learner}} has successfully completed {{course}}.",
    signatoryName: "Demo Administrator",
    signatoryTitle: "Programme Director",
    isDefault: true,
  });

  const instructor = await actorFromUser(teacher.id);
  const adminActor = await actorFromUser(admin.id);

  // --- A complete, published free course ----------------------------------
  const free = await courses.createCourse(instructor, { title: "[Demo] Getting Started with Online Learning" });
  await courses.updateCourse(instructor, free.id, {
    title: free.title,
    slug: "demo-getting-started",
    shortDescription: "A short demonstration course that shows lessons, a quiz, an assignment and a certificate.",
    description:
      "This is **demonstration content** created by the development seed script.\n\nIt exists so that you can try every part of the platform: reading lessons, tracking progress, taking a quiz, submitting an assignment and earning a certificate.",
    categoryId: business!.id,
    level: "beginner",
    language: "English",
    estimatedMinutes: 45,
    objectives: ["Find your way around a course", "Complete lessons and track progress", "Take a quiz and submit an assignment"],
    prerequisites: [],
    priceCents: 0,
    enrollmentOpen: true,
    enrollmentLimit: null,
    requireAllLessons: true,
    requireAssessments: true,
    requireAssignments: false,
    certificateEnabled: true,
    tagIds: [],
  });
  const intro = await courses.createModule(instructor, free.id, { title: "Introduction", description: "Start here.", isPublished: true });
  const practice = await courses.createModule(instructor, free.id, { title: "Practice", description: "Apply what you learned.", isPublished: true });
  const lesson = (title: string, content: string, isPreview = false) => ({
    title,
    description: "",
    content,
    videoUrl: "",
    estimatedMinutes: 10,
    isPreview,
    isPublished: true,
  });
  await courses.createLesson(
    instructor,
    intro.id,
    lesson(
      "Welcome to the course",
      "## Welcome\n\nThis lesson is a **free preview**: anyone can read it without enrolling.\n\n- Lessons are written in Markdown.\n- Your progress is saved to your account.\n- Use *Mark lesson complete* when you have finished.",
      true,
    ),
  );
  await courses.createLesson(
    instructor,
    intro.id,
    lesson("How progress works", "Opening a lesson does **not** complete it. Progress only moves when you mark a lesson complete.\n\n| Action | Counts as progress |\n| --- | --- |\n| Opening a lesson | No |\n| Marking it complete | Yes |"),
  );
  const last = await courses.createLesson(
    instructor,
    practice.id,
    lesson("Putting it together", "You are nearly done.\n\n1. Complete this lesson.\n2. Pass the quiz.\n3. Your certificate is issued automatically."),
  );

  const quiz = await assessments.createAssessment(instructor, free.id, {
    kind: "quiz",
    title: "[Demo] Course quiz",
    instructions: "Three short questions. You have two attempts.",
    lessonId: last.id,
    passMarkPercent: 60,
    maxAttempts: 2,
    resultRelease: "immediate",
    showCorrectAnswers: true,
    requiredForCompletion: true,
  });
  await assessments.addNewQuestion(instructor, quiz.id, {
    type: "multiple_choice",
    text: "What moves your course progress forward?",
    marks: 2,
    explanation: "Progress is based on lessons you explicitly complete.",
    options: [
      { text: "Opening a lesson", isCorrect: false },
      { text: "Marking a lesson complete", isCorrect: true },
      { text: "Signing in", isCorrect: false },
    ],
  });
  await assessments.addNewQuestion(instructor, quiz.id, {
    type: "true_false",
    text: "Your progress is stored on your account and follows you between devices.",
    marks: 1,
    options: [
      { text: "True", isCorrect: true },
      { text: "False", isCorrect: false },
    ],
  });
  await assessments.addNewQuestion(instructor, quiz.id, {
    type: "multiple_select",
    text: "Which of these can be part of a course? Select all that apply.",
    marks: 2,
    options: [
      { text: "Lessons", isCorrect: true },
      { text: "Quizzes", isCorrect: true },
      { text: "Assignments", isCorrect: true },
      { text: "Bank transfers", isCorrect: false },
    ],
  });
  await assessments.setAssessmentPublished(instructor, quiz.id, true);

  const task = await assignments.createAssignment(instructor, free.id, {
    title: "[Demo] Reflection",
    instructions: "Write a short paragraph about what you would like to learn next. You may attach a PDF.",
    maxMarks: 20,
    passMarkPercent: 50,
    latePolicy: "accept",
    allowedExtensions: ["pdf"],
    requiredForCompletion: false,
  });
  await assignments.setAssignmentPublished(instructor, task.id, true);

  await courses.requestPublication(instructor, free.id);
  await courses.reviewCourse(adminActor, free.id, "approve", "Seeded demonstration course.");

  // --- A published paid course --------------------------------------------
  const paid = await courses.createCourse(instructor, { title: "[Demo] Spreadsheet Essentials" });
  await courses.updateCourse(instructor, paid.id, {
    title: paid.title,
    slug: "demo-spreadsheet-essentials",
    shortDescription: "A demonstration paid course used to try the checkout flow in test mode.",
    description: "This is **demonstration content**. The price is illustrative and no real payment can be taken in sandbox mode.",
    categoryId: technology!.id,
    level: "intermediate",
    language: "English",
    estimatedMinutes: 120,
    objectives: ["Organise data in a spreadsheet", "Use formulas with confidence"],
    prerequisites: ["Basic computer skills"],
    priceCents: 150000,
    enrollmentOpen: true,
    enrollmentLimit: null,
    requireAllLessons: true,
    requireAssessments: true,
    requireAssignments: true,
    certificateEnabled: true,
    tagIds: [],
  });
  const paidModule = await courses.createModule(instructor, paid.id, { title: "Foundations", description: "", isPublished: true });
  await courses.createLesson(instructor, paidModule.id, lesson("Cells, rows and columns", "Demonstration lesson content.", true));
  await courses.createLesson(instructor, paidModule.id, lesson("Your first formula", "Demonstration lesson content."));
  await courses.requestPublication(instructor, paid.id);
  await courses.reviewCourse(adminActor, paid.id, "approve", "Seeded demonstration course.");

  // --- A draft, to show the unpublished state -----------------------------
  await courses.createCourse(instructor, { title: "[Demo] Unpublished Draft Course" });

  console.log(`
Demonstration data created. These are NOT real users.

  Role           Email                      Password
  Administrator  admin@example.test         ${PASSWORD}
  Instructor     instructor@example.test    ${PASSWORD}
  Learner        learner@example.test       ${PASSWORD}
  Learner        learner2@example.test      ${PASSWORD}

Never run this against a production database.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
