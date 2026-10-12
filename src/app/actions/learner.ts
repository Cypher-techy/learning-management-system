"use server";

import { bool, list, str } from "@/lib/form";
import { authed, open, type ActionState } from "@/server/action";
import { clientIp } from "@/server/auth/session";
import { applyToTeach, requestAccountDeletion, updateNotificationPrefs, updateOwnProfile } from "@/server/services/admin";
import { saveAnswer, startAttempt, submitAttempt } from "@/server/services/assessments";
import { saveSubmission } from "@/server/services/assignments";
import {
  createDiscussion,
  createSupportRequest,
  moderateDiscussion,
  moderateReply,
  replyToDiscussion,
  reportContent,
} from "@/server/services/community";
import { enrollInFreeCourse } from "@/server/services/enrollment";
import { LOCKED_CATEGORIES, markAllRead, markRead, NOTIFICATION_CATEGORIES } from "@/server/services/notifications";
import { completeSandboxPayment, refreshPaymentStatus, requestRefund, startCheckout } from "@/server/services/payments";
import { saveNote, saveVideoPosition, setLessonCompleted, toggleBookmark } from "@/server/services/progress";

// --- Enrollment and payments -----------------------------------------------

export async function enrollAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const result = await enrollInFreeCourse(actor, str(fd, "courseId"));
    return { redirect: `/learn/courses/${result.slug}` };
  });
}

export async function checkoutAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const { transaction } = await startCheckout(actor, str(fd, "courseId"), { phone: str(fd, "phone") });
    return { redirect: `/checkout/status/${transaction.id}` };
  });
}

export async function refreshPaymentAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const id = str(fd, "transactionId");
    const status = await refreshPaymentStatus(actor, id);
    return {
      message: status === "pending" ? "The payment has not been confirmed yet." : `Payment ${status}.`,
      revalidate: [`/checkout/status/${id}`],
    };
  });
}

export async function sandboxPaymentAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const id = str(fd, "transactionId");
    const outcome = str(fd, "outcome") === "succeeded" ? "succeeded" : "failed";
    await completeSandboxPayment(actor, id, outcome);
    return { message: `Sandbox payment marked as ${outcome}.`, revalidate: [`/checkout/status/${id}`] };
  });
}

export async function requestRefundAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await requestRefund(actor, str(fd, "transactionId"), str(fd, "reason"));
    return { message: "Your refund request was sent for review.", revalidate: ["/learn/purchases"] };
  });
}

// --- Lessons ---------------------------------------------------------------

export async function lessonCompleteAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const completed = bool(fd, "completed");
    const result = await setLessonCompleted(actor, str(fd, "lessonId"), completed);
    return {
      message: result.courseCompleted && completed ? "Course completed. Well done!" : completed ? "Lesson marked complete." : "Lesson marked incomplete.",
      revalidate: [`/learn/courses/${result.slug}`, "/learn"],
      data: { percent: result.percent },
    };
  });
}

export async function bookmarkAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const result = await toggleBookmark(actor, str(fd, "lessonId"));
    return {
      message: result.bookmarked ? "Bookmarked." : "Bookmark removed.",
      revalidate: [`/learn/courses/${result.slug}`, "/learn/bookmarks"],
    };
  });
}

export async function saveNoteAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await saveNote(actor, str(fd, "lessonId"), str(fd, "content"));
    return { message: "Note saved.", revalidate: ["/learn/bookmarks"] };
  });
}

export async function videoPositionAction(lessonId: string, seconds: number): Promise<void> {
  await authed(async (actor) => {
    await saveVideoPosition(actor, String(lessonId), Number(seconds) || 0);
  }, { refresh: false });
}

// --- Assessments -----------------------------------------------------------

export async function startAttemptAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const attempt = await startAttempt(actor, str(fd, "assessmentId"));
    return { redirect: `/learn/attempts/${attempt.id}` };
  });
}

export type SaveAnswerInput = {
  attemptId: string;
  questionId: string;
  selectedOptionIds: string[];
  textAnswer: string;
  fileId: string | null;
};

/** Autosave endpoint used by the exam screen. */
export async function saveAnswerAction(input: SaveAnswerInput): Promise<ActionState> {
  return authed(async (actor) => {
    const { savedAt } = await saveAnswer(actor, String(input.attemptId), {
      questionId: String(input.questionId),
      selectedOptionIds: Array.isArray(input.selectedOptionIds) ? input.selectedOptionIds.map(String) : [],
      textAnswer: typeof input.textAnswer === "string" ? input.textAnswer : "",
      fileId: input.fileId ? String(input.fileId) : null,
    });
    return { data: { savedAt: savedAt.toISOString() } };
  }, { refresh: false });
}

export async function submitAttemptAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const attempt = await submitAttempt(actor, str(fd, "attemptId"));
    return { redirect: `/learn/attempts/${attempt.id}/result` };
  });
}

// --- Assignments -----------------------------------------------------------

export async function saveSubmissionAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const assignmentId = str(fd, "assignmentId");
    const submit = str(fd, "intent") === "submit";
    const result = await saveSubmission(actor, assignmentId, {
      textResponse: str(fd, "textResponse"),
      fileIds: list(fd, "fileIds"),
      submit,
    });
    return {
      message: result.submitted ? (result.late ? "Submitted (late)." : "Assignment submitted.") : "Draft saved.",
      revalidate: [`/learn/assignments/${assignmentId}`],
    };
  });
}

// --- Notifications and account ---------------------------------------------

export async function markReadAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await markRead(actor, str(fd, "id"));
    return { revalidate: ["/notifications"] };
  });
}

export async function markAllReadAction(): Promise<ActionState> {
  return authed(async (actor) => {
    await markAllRead(actor);
    return { message: "All notifications marked as read.", revalidate: ["/notifications"] };
  });
}

export async function updateProfileAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await updateOwnProfile(actor, {
      name: str(fd, "name"),
      headline: str(fd, "headline"),
      bio: str(fd, "bio"),
      phone: str(fd, "phone"),
      country: str(fd, "country"),
    });
    return { message: "Profile updated.", revalidate: ["/account"] };
  });
}

export async function updatePrefsAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const editable = Object.keys(NOTIFICATION_CATEGORIES).filter(
      (c) => !(LOCKED_CATEGORIES as string[]).includes(c),
    );
    await updateNotificationPrefs(actor, {
      emailOff: editable.filter((c) => !bool(fd, `email:${c}`)),
      inAppOff: editable.filter((c) => !bool(fd, `inApp:${c}`)),
    });
    return { message: "Notification preferences saved.", revalidate: ["/account"] };
  });
}

export async function requestDeletionAction(): Promise<ActionState> {
  return authed(async (actor) => {
    await requestAccountDeletion(actor);
    return { message: "Your deletion request was sent to the administrators.", revalidate: ["/account"] };
  });
}

export async function applyToTeachAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await applyToTeach(actor, { expertise: str(fd, "expertise"), motivation: str(fd, "motivation") });
    return { message: "Application sent. We will notify you once it is reviewed.", revalidate: ["/teach"] };
  });
}

// --- Discussions -----------------------------------------------------------

export async function createDiscussionAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const row = await createDiscussion(actor, str(fd, "courseId"), { title: str(fd, "title"), body: str(fd, "body") });
    return { redirect: `/discussions/${row.id}` };
  });
}

export async function replyAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const discussion = await replyToDiscussion(actor, str(fd, "discussionId"), str(fd, "body"));
    return { message: "Reply posted.", revalidate: [`/discussions/${discussion.id}`] };
  });
}

export async function reportAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const replyId = str(fd, "replyId");
    const discussion = await reportContent(
      actor,
      replyId ? { replyId } : { discussionId: str(fd, "discussionId") },
      str(fd, "reason"),
    );
    return { message: "Thank you. A moderator will review this.", revalidate: [`/discussions/${discussion.id}`] };
  });
}

export async function moderateDiscussionAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const action = str(fd, "action") as Parameters<typeof moderateDiscussion>[2];
    if (!["pin", "unpin", "lock", "unlock", "hide", "unhide"].includes(action)) return { message: "" };
    const discussion = await moderateDiscussion(actor, str(fd, "discussionId"), action);
    return { message: "Discussion updated.", revalidate: [`/discussions/${discussion.id}`] };
  });
}

export async function moderateReplyAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const discussion = await moderateReply(actor, str(fd, "replyId"), bool(fd, "hidden"));
    return { message: "Reply updated.", revalidate: [`/discussions/${discussion.id}`] };
  });
}

// --- Public ----------------------------------------------------------------

export async function contactAction(fd: FormData): Promise<ActionState> {
  return open(async (actor) => {
    // Honeypot: real visitors never fill this hidden field.
    if (str(fd, "website") !== "") return { message: "Thank you. Your message has been received." };
    await createSupportRequest(actor, await clientIp(), {
      name: str(fd, "name"),
      email: str(fd, "email"),
      subject: str(fd, "subject"),
      message: str(fd, "message"),
    });
    return { message: "Thank you. Your message has been received." };
  });
}
