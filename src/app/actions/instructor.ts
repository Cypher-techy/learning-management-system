"use server";

import { bool, date, lines, list, money, num, optNum, optStr, str, tokens } from "@/lib/form";
import { authed, type ActionState } from "@/server/action";
import { invalid } from "@/server/errors";
import {
  addBankQuestions,
  addNewQuestion,
  createAssessment,
  createBank,
  createQuestion,
  deleteAssessment,
  deleteBank,
  deleteQuestion,
  gradeAttempt,
  releaseResults,
  removeQuestionFromAssessment,
  reorderAssessmentQuestions,
  setAssessmentPublished,
  updateAssessment,
  updateQuestion,
  type AssessmentInput,
  type QuestionInput,
} from "@/server/services/assessments";
import {
  createAssignment,
  deleteAssignment,
  gradeSubmission,
  setAssignmentPublished,
  updateAssignment,
  type AssignmentInput,
} from "@/server/services/assignments";
import {
  createCourseAnnouncement,
  createLiveSession,
  deleteAnnouncement,
  deleteLiveSession,
} from "@/server/services/community";
import {
  addCourseInstructor,
  addFileResource,
  addLinkResource,
  createCourse,
  createLesson,
  createModule,
  deleteLesson,
  deleteModule,
  deleteResource,
  removeCourseInstructor,
  reorderLessons,
  reorderModules,
  requestPublication,
  setCourseStatus,
  setCourseThumbnail,
  setLessonVideoFile,
  updateCourse,
  updateLesson,
  updateModule,
} from "@/server/services/courses";

// --- Courses ---------------------------------------------------------------

export async function createCourseAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const course = await createCourse(actor, { title: str(fd, "title") });
    return { redirect: `/instructor/courses/${course.id}` };
  });
}

export async function updateCourseAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await updateCourse(actor, str(fd, "courseId"), {
      title: str(fd, "title"),
      slug: str(fd, "slug").trim().toLowerCase(),
      shortDescription: str(fd, "shortDescription"),
      description: str(fd, "description"),
      categoryId: optStr(fd, "categoryId"),
      level: str(fd, "level") as never,
      language: str(fd, "language"),
      estimatedMinutes: Math.round((optNum(fd, "estimatedHours") ?? 0) * 60),
      objectives: lines(fd, "objectives"),
      prerequisites: lines(fd, "prerequisites"),
      priceCents: money(fd, "price"),
      enrollmentOpen: bool(fd, "enrollmentOpen"),
      enrollmentLimit: optNum(fd, "enrollmentLimit"),
      requireAllLessons: bool(fd, "requireAllLessons"),
      requireAssessments: bool(fd, "requireAssessments"),
      requireAssignments: bool(fd, "requireAssignments"),
      certificateEnabled: bool(fd, "certificateEnabled"),
      tagIds: list(fd, "tagIds"),
    });
    return { message: "Course details saved." };
  });
}

export async function setThumbnailAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await setCourseThumbnail(actor, str(fd, "courseId"), optStr(fd, "fileId"));
    return { message: optStr(fd, "fileId") ? "Thumbnail updated." : "Thumbnail removed." };
  });
}

export async function publishCourseAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const status = await requestPublication(actor, str(fd, "courseId"));
    return { message: status === "published" ? "The course is now published." : "Submitted for administrator review." };
  });
}

export async function courseStatusAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const action = str(fd, "action");
    if (!["unpublish", "archive", "restore", "withdraw"].includes(action)) return { message: "" };
    const next = await setCourseStatus(actor, str(fd, "courseId"), action as "unpublish" | "archive" | "restore" | "withdraw");
    return { message: `Course status: ${next.replace("_", " ")}.` };
  });
}

export async function addInstructorAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await addCourseInstructor(actor, str(fd, "courseId"), str(fd, "email"));
    return { message: "Instructor added to the teaching team." };
  });
}

export async function removeInstructorAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await removeCourseInstructor(actor, str(fd, "courseId"), str(fd, "userId"));
    return { message: "Instructor removed." };
  });
}

// --- Curriculum ------------------------------------------------------------

const moduleInput = (fd: FormData) => ({
  title: str(fd, "title"),
  description: str(fd, "description"),
  isPublished: bool(fd, "isPublished"),
});

export async function createModuleAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await createModule(actor, str(fd, "courseId"), { ...moduleInput(fd), isPublished: true });
    return { message: "Module added." };
  });
}

export async function updateModuleAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await updateModule(actor, str(fd, "moduleId"), moduleInput(fd));
    return { message: "Module saved." };
  });
}

export async function deleteModuleAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await deleteModule(actor, str(fd, "moduleId"));
    return { message: "Module deleted." };
  });
}

export async function reorderModulesAction(courseId: string, orderedIds: string[]): Promise<ActionState> {
  return authed(async (actor) => {
    await reorderModules(actor, String(courseId), Array.isArray(orderedIds) ? orderedIds.map(String) : []);
    return { message: "Module order saved." };
  });
}

export async function reorderLessonsAction(moduleId: string, orderedIds: string[]): Promise<ActionState> {
  return authed(async (actor) => {
    await reorderLessons(actor, String(moduleId), Array.isArray(orderedIds) ? orderedIds.map(String) : []);
    return { message: "Lesson order saved." };
  });
}

export async function createLessonAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const lesson = await createLesson(actor, str(fd, "moduleId"), {
      title: str(fd, "title"),
      description: "",
      content: "",
      videoUrl: "",
      estimatedMinutes: 0,
      isPreview: false,
      // New lessons start hidden so half-written content is never shown to learners.
      isPublished: false,
    });
    return { redirect: `/instructor/courses/${lesson.courseId}/lessons/${lesson.id}` };
  });
}

export async function updateLessonAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await updateLesson(actor, str(fd, "lessonId"), {
      title: str(fd, "title"),
      description: str(fd, "description"),
      content: str(fd, "content"),
      videoUrl: str(fd, "videoUrl"),
      estimatedMinutes: Math.round(optNum(fd, "estimatedMinutes") ?? 0),
      isPreview: bool(fd, "isPreview"),
      isPublished: bool(fd, "isPublished"),
    });
    return { message: "Lesson saved." };
  });
}

export async function deleteLessonAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const courseId = await deleteLesson(actor, str(fd, "lessonId"));
    return { redirect: `/instructor/courses/${courseId}/curriculum` };
  });
}

export async function setLessonVideoAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await setLessonVideoFile(actor, str(fd, "lessonId"), optStr(fd, "fileId"));
    return { message: optStr(fd, "fileId") ? "Video attached." : "Video removed." };
  });
}

export async function addLinkResourceAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await addLinkResource(actor, str(fd, "lessonId"), { title: str(fd, "title"), url: str(fd, "url") });
    return { message: "Link added." };
  });
}

export async function addFileResourceAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await addFileResource(actor, str(fd, "lessonId"), str(fd, "fileId"), str(fd, "fileName"));
    return { message: "File attached." };
  });
}

export async function deleteResourceAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await deleteResource(actor, str(fd, "resourceId"));
    return { message: "Resource removed." };
  });
}

// --- Assessments -----------------------------------------------------------

const assessmentInput = (fd: FormData): AssessmentInput => ({
  kind: str(fd, "kind") as never,
  title: str(fd, "title"),
  instructions: str(fd, "instructions"),
  lessonId: optStr(fd, "lessonId"),
  startsAt: date(fd, "startsAt"),
  endsAt: date(fd, "endsAt"),
  timeLimitMinutes: optNum(fd, "timeLimitMinutes"),
  passMarkPercent: num(fd, "passMarkPercent"),
  maxAttempts: num(fd, "maxAttempts"),
  shuffleQuestions: bool(fd, "shuffleQuestions"),
  shuffleOptions: bool(fd, "shuffleOptions"),
  negativeMarkingPercent: optNum(fd, "negativeMarkingPercent") ?? 0,
  resultRelease: str(fd, "resultRelease") as never,
  showCorrectAnswers: bool(fd, "showCorrectAnswers"),
  requiredForCompletion: bool(fd, "requiredForCompletion"),
});

export async function createAssessmentAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const row = await createAssessment(actor, str(fd, "courseId"), {
      kind: str(fd, "kind") as never,
      title: str(fd, "title"),
      passMarkPercent: 50,
      maxAttempts: 1,
      resultRelease: "immediate",
    });
    return { redirect: `/instructor/assessments/${row.id}` };
  });
}

export async function updateAssessmentAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await updateAssessment(actor, str(fd, "assessmentId"), assessmentInput(fd));
    return { message: "Settings saved." };
  });
}

export async function publishAssessmentAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const published = bool(fd, "published");
    await setAssessmentPublished(actor, str(fd, "assessmentId"), published);
    return { message: published ? "Published. Enrolled learners can now see it." : "Unpublished." };
  });
}

export async function deleteAssessmentAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const row = await deleteAssessment(actor, str(fd, "assessmentId"));
    return { redirect: `/instructor/courses/${row.courseId}/assessments` };
  });
}

/** The question editor posts its state as JSON; it is validated in the service. */
function questionInput(fd: FormData): QuestionInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(str(fd, "question"));
  } catch {
    parsed = {};
  }
  return parsed as QuestionInput;
}

export async function addQuestionAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await addNewQuestion(actor, str(fd, "assessmentId"), questionInput(fd));
    return { message: "Question added." };
  });
}

export async function addBankQuestionsAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const ids = list(fd, "questionIds");
    await addBankQuestions(actor, str(fd, "assessmentId"), ids);
    return { message: `${ids.length} question${ids.length === 1 ? "" : "s"} added.` };
  });
}

export async function removeQuestionAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await removeQuestionFromAssessment(actor, str(fd, "assessmentId"), str(fd, "questionId"));
    return { message: "Question removed from this assessment. It remains in the question bank." };
  });
}

export async function reorderQuestionsAction(assessmentId: string, orderedIds: string[]): Promise<ActionState> {
  return authed(async (actor) => {
    await reorderAssessmentQuestions(actor, String(assessmentId), Array.isArray(orderedIds) ? orderedIds.map(String) : []);
    return { message: "Question order saved." };
  });
}

export async function releaseResultsAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const { released } = await releaseResults(actor, str(fd, "assessmentId"));
    return { message: released === 0 ? "There were no held results to release." : `Released ${released} result${released === 1 ? "" : "s"}.` };
  });
}

export async function gradeAttemptAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const attemptId = str(fd, "attemptId");
    const grades = list(fd, "questionIds").map((questionId) => ({
      questionId,
      marks: num(fd, `marks:${questionId}`),
      feedback: str(fd, `feedback:${questionId}`),
    }));
    const { assessment } = await gradeAttempt(actor, attemptId, { grades, feedback: str(fd, "feedback") });
    return { redirect: `/instructor/assessments/${assessment.id}/attempts` };
  });
}

// --- Question banks --------------------------------------------------------

export async function createBankAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const bank = await createBank(actor, {
      title: str(fd, "title"),
      description: str(fd, "description"),
      courseId: optStr(fd, "courseId"),
    });
    return { redirect: `/instructor/question-banks/${bank.id}` };
  });
}

export async function deleteBankAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await deleteBank(actor, str(fd, "bankId"));
    return { redirect: "/instructor/question-banks" };
  });
}

export async function saveBankQuestionAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const questionId = optStr(fd, "questionId");
    if (questionId) await updateQuestion(actor, questionId, questionInput(fd));
    else await createQuestion(actor, str(fd, "bankId"), questionInput(fd));
    return { message: questionId ? "Question updated." : "Question added." };
  });
}

export async function deleteQuestionAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await deleteQuestion(actor, str(fd, "questionId"));
    return { message: "Question deleted." };
  });
}

// --- Assignments -----------------------------------------------------------

const assignmentInput = (fd: FormData): AssignmentInput => ({
  title: str(fd, "title"),
  instructions: str(fd, "instructions"),
  lessonId: optStr(fd, "lessonId"),
  dueAt: date(fd, "dueAt"),
  maxMarks: num(fd, "maxMarks"),
  passMarkPercent: num(fd, "passMarkPercent"),
  allowText: bool(fd, "allowText"),
  allowFiles: bool(fd, "allowFiles"),
  allowedExtensions: tokens(fd, "allowedExtensions"),
  maxFiles: optNum(fd, "maxFiles") ?? 3,
  latePolicy: str(fd, "latePolicy") as never,
  latePenaltyPercent: optNum(fd, "latePenaltyPercent") ?? 0,
  allowResubmission: bool(fd, "allowResubmission"),
  requiredForCompletion: bool(fd, "requiredForCompletion"),
});

export async function createAssignmentAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const row = await createAssignment(actor, str(fd, "courseId"), {
      title: str(fd, "title"),
      maxMarks: 100,
      passMarkPercent: 50,
      latePolicy: "accept",
    });
    return { redirect: `/instructor/assignments/${row.id}` };
  });
}

export async function updateAssignmentAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await updateAssignment(actor, str(fd, "assignmentId"), assignmentInput(fd));
    return { message: "Assignment saved." };
  });
}

export async function publishAssignmentAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const published = bool(fd, "published");
    await setAssignmentPublished(actor, str(fd, "assignmentId"), published);
    return { message: published ? "Published. Enrolled learners can now see it." : "Unpublished." };
  });
}

export async function deleteAssignmentAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const row = await deleteAssignment(actor, str(fd, "assignmentId"));
    return { redirect: `/instructor/courses/${row.courseId}/assignments` };
  });
}

export async function gradeSubmissionAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const { assignment } = await gradeSubmission(actor, str(fd, "submissionId"), {
      marks: num(fd, "marks"),
      feedback: str(fd, "feedback"),
      release: bool(fd, "release"),
    });
    return { redirect: `/instructor/assignments/${assignment.id}` };
  });
}

// --- Communication ---------------------------------------------------------

export async function createAnnouncementAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await createCourseAnnouncement(actor, str(fd, "courseId"), { title: str(fd, "title"), body: str(fd, "body") });
    return { message: "Announcement posted and learners notified." };
  });
}

export async function deleteAnnouncementAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await deleteAnnouncement(actor, str(fd, "announcementId"));
    return { message: "Announcement deleted." };
  });
}

export async function createLiveSessionAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const startsAt = date(fd, "startsAt");
    if (!startsAt) throw invalid("Choose a start date and time.", { startsAt: ["Required."] });
    await createLiveSession(actor, str(fd, "courseId"), {
      title: str(fd, "title"),
      description: str(fd, "description"),
      provider: str(fd, "provider") as never,
      joinUrl: str(fd, "joinUrl"),
      startsAt,
      durationMinutes: num(fd, "durationMinutes"),
    });
    return { message: "Live session scheduled and learners notified." };
  });
}

export async function deleteLiveSessionAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await deleteLiveSession(actor, str(fd, "sessionId"));
    return { message: "Live session removed." };
  });
}
