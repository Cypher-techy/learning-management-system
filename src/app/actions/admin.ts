"use server";

import { bool, list, num, optNum, optStr, str, tokens } from "@/lib/form";
import { authed, type ActionState } from "@/server/action";
import { isRole } from "@/server/permissions";
import {
  anonymizeUser,
  assertPasswordConfirmed,
  createTag,
  createUser,
  deleteCategory,
  deleteTag,
  reactivateUser,
  reviewApplication,
  revokeUserSessions,
  saveCategory,
  setRolePermissions,
  setUserRole,
  suspendUser,
  updateUser,
} from "@/server/services/admin";
import { deleteTemplate, reinstateCertificate, revokeCertificate, saveTemplate } from "@/server/services/certificates";
import { createPlatformAnnouncement, deleteAnnouncement, resolveReport, updateSupportRequest } from "@/server/services/community";
import { deleteCourse, reviewCourse } from "@/server/services/courses";
import { grantEnrollment, setEnrollmentStatus } from "@/server/services/enrollment";
import { decideRefund } from "@/server/services/payments";
import { updateSettings, type PlatformSettings } from "@/server/services/settings";

// --- Users -----------------------------------------------------------------

export async function createUserAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const role = str(fd, "role");
    const user = await createUser(actor, {
      name: str(fd, "name"),
      email: str(fd, "email"),
      password: str(fd, "password"),
      role: isRole(role) ? role : "student",
    });
    return { redirect: `/admin/users/${user.id}` };
  });
}

export async function updateUserAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await updateUser(actor, str(fd, "userId"), { name: str(fd, "name"), email: str(fd, "email") });
    return { message: "User details saved." };
  });
}

export async function setRoleAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const role = str(fd, "role");
    if (!isRole(role)) return { message: "" };
    await setUserRole(actor, str(fd, "userId"), role, str(fd, "confirmPassword"));
    return { message: `Role changed to ${role}. The user has been signed out.` };
  });
}

export async function suspendUserAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await suspendUser(actor, str(fd, "userId"), str(fd, "reason"), str(fd, "confirmPassword"));
    return { message: "Account suspended and all sessions revoked." };
  });
}

export async function reactivateUserAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await reactivateUser(actor, str(fd, "userId"));
    return { message: "Account reactivated." };
  });
}

export async function revokeSessionsAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await revokeUserSessions(actor, str(fd, "userId"));
    return { message: "All sessions for this user were signed out." };
  });
}

export async function anonymizeUserAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await anonymizeUser(actor, str(fd, "userId"), str(fd, "confirmPassword"));
    return { message: "The account was deleted and anonymised.", redirect: "/admin/users" };
  });
}

export async function reviewApplicationAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const decision = str(fd, "decision") === "approve" ? "approve" : "reject";
    await reviewApplication(actor, str(fd, "applicationId"), decision, str(fd, "note"));
    return { message: decision === "approve" ? "Application approved. The user is now an instructor." : "Application rejected." };
  });
}

export async function savePermissionsAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const role = str(fd, "role");
    if (role !== "instructor") return { message: "" };
    await setRolePermissions(actor, role, list(fd, "permissions"), str(fd, "confirmPassword"));
    return { message: "Permissions updated. They apply to each user's next request." };
  });
}

// --- Courses and catalogue -------------------------------------------------

export async function reviewCourseAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const decision = str(fd, "decision") === "approve" ? "approve" : "reject";
    await reviewCourse(actor, str(fd, "courseId"), decision, str(fd, "note"));
    return { message: decision === "approve" ? "Course approved and published." : "Returned to the instructor with your note." };
  });
}

export async function deleteCourseAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await assertPasswordConfirmed(actor, str(fd, "confirmPassword"));
    await deleteCourse(actor, str(fd, "courseId"));
    return { redirect: "/admin/courses" };
  });
}

export async function saveCategoryAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await saveCategory(actor, optStr(fd, "categoryId"), {
      name: str(fd, "name"),
      description: str(fd, "description"),
      position: optNum(fd, "position") ?? 0,
    });
    return { message: "Category saved." };
  });
}

export async function deleteCategoryAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await deleteCategory(actor, str(fd, "categoryId"));
    return { message: "Category deleted. Its courses are now uncategorised." };
  });
}

export async function createTagAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await createTag(actor, str(fd, "name"));
    return { message: "Tag added." };
  });
}

export async function deleteTagAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await deleteTag(actor, str(fd, "tagId"));
    return { message: "Tag deleted." };
  });
}

// --- Enrollments -----------------------------------------------------------

export async function grantEnrollmentAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const result = await grantEnrollment(actor, str(fd, "email"), str(fd, "courseId"));
    return { message: result.created ? "Enrollment granted." : "That learner already has access to this course." };
  });
}

export async function enrollmentStatusAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const status = str(fd, "status");
    if (status !== "active" && status !== "suspended" && status !== "cancelled") return { message: "" };
    await setEnrollmentStatus(actor, str(fd, "enrollmentId"), status);
    return { message: `Enrollment ${status === "active" ? "reactivated" : status}.` };
  });
}

// --- Certificates ----------------------------------------------------------

export async function revokeCertificateAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await revokeCertificate(actor, str(fd, "certificateId"), str(fd, "reason"));
    return { message: "Certificate revoked. The verification page now shows it as revoked." };
  });
}

export async function reinstateCertificateAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await reinstateCertificate(actor, str(fd, "certificateId"));
    return { message: "Certificate reinstated." };
  });
}

export async function saveTemplateAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await saveTemplate(actor, optStr(fd, "templateId"), {
      name: str(fd, "name"),
      heading: str(fd, "heading"),
      body: str(fd, "body"),
      issuerName: str(fd, "issuerName"),
      signatoryName: str(fd, "signatoryName"),
      signatoryTitle: str(fd, "signatoryTitle"),
      accentColor: str(fd, "accentColor"),
      showScore: bool(fd, "showScore"),
      isDefault: bool(fd, "isDefault"),
    });
    return { message: "Certificate template saved." };
  });
}

export async function deleteTemplateAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await deleteTemplate(actor, str(fd, "templateId"));
    return { message: "Template deleted." };
  });
}

// --- Communication and support ---------------------------------------------

export async function platformAnnouncementAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await createPlatformAnnouncement(actor, { title: str(fd, "title"), body: str(fd, "body") });
    return { message: "Announcement sent to all users." };
  });
}

export async function deletePlatformAnnouncementAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    await deleteAnnouncement(actor, str(fd, "announcementId"));
    return { message: "Announcement deleted." };
  });
}

export async function updateSupportAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const status = str(fd, "status");
    if (status !== "open" && status !== "in_progress" && status !== "closed") return { message: "" };
    await updateSupportRequest(actor, str(fd, "requestId"), { status, adminNote: str(fd, "adminNote") });
    return { message: "Support request updated." };
  });
}

export async function resolveReportAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const action = str(fd, "action") === "hide_content" ? "hide_content" : "dismiss";
    await resolveReport(actor, str(fd, "reportId"), action);
    return { message: action === "hide_content" ? "Content hidden and report resolved." : "Report dismissed." };
  });
}

// --- Payments --------------------------------------------------------------

export async function decideRefundAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const decision = str(fd, "decision") === "approve" ? "approve" : "reject";
    await assertPasswordConfirmed(actor, str(fd, "confirmPassword"));
    await decideRefund(actor, str(fd, "refundId"), decision, str(fd, "note"));
    return {
      message:
        decision === "approve"
          ? "Refund approved and access removed. Return the money through the payment provider."
          : "Refund request declined.",
    };
  });
}

// --- Settings --------------------------------------------------------------

export async function saveSettingsAction(fd: FormData): Promise<ActionState> {
  return authed(async (actor) => {
    const section = str(fd, "section");
    let patch: Partial<PlatformSettings>;
    if (section === "general") {
      patch = {
        platformName: str(fd, "platformName"),
        platformDescription: str(fd, "platformDescription"),
        organizationName: str(fd, "organizationName"),
        supportEmail: str(fd, "supportEmail").trim(),
        supportPhone: str(fd, "supportPhone"),
        theme: str(fd, "theme") as PlatformSettings["theme"],
        cgsWebsiteUrl: str(fd, "cgsWebsiteUrl"),
        termsUrl: str(fd, "termsUrl"),
        privacyUrl: str(fd, "privacyUrl"),
      };
    } else if (section === "learning") {
      patch = {
        registrationEnabled: bool(fd, "registrationEnabled"),
        selfEnrollmentEnabled: bool(fd, "selfEnrollmentEnabled"),
        courseApprovalRequired: bool(fd, "courseApprovalRequired"),
        emailNotificationsEnabled: bool(fd, "emailNotificationsEnabled"),
        currency: str(fd, "currency").toUpperCase(),
        defaultRequireAllLessons: bool(fd, "defaultRequireAllLessons"),
        defaultRequireAssessments: bool(fd, "defaultRequireAssessments"),
        defaultRequireAssignments: bool(fd, "defaultRequireAssignments"),
      };
    } else if (section === "uploads") {
      patch = { maxUploadMb: num(fd, "maxUploadMb"), allowedUploadExtensions: tokens(fd, "allowedUploadExtensions") };
    } else if (section === "logo") {
      patch = { logoFileId: optStr(fd, "fileId") };
    } else {
      return { message: "" };
    }
    await updateSettings(actor, patch);
    return { message: "Settings saved." };
  });
}
