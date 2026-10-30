import { getDB, courseLessons, isPremiumActive, publicUser, type DB, type User } from "./db";

export function nameOf(db: DB, id: string) { return db.users.find(u => u.id === id)?.fullName || "Unknown"; }
export function wallet(db: DB, teacherId: string) {
  const txs = db.walletTxs.filter(t => t.teacherId === teacherId);
  const earned = txs.filter(t => t.type === "earning" || (t.type === "adjustment" && t.amount > 0)).reduce((a, t) => a + Math.max(t.amount, 0), 0);
  const withdrawn = Math.abs(txs.filter(t => t.type === "withdrawal").reduce((a, t) => a + t.amount, 0));
  const heldByPending = db.withdrawals.filter(w => w.teacherId === teacherId && w.status === "pending").reduce((a, w) => a + w.amount, 0);
  const balance = txs.reduce((a, t) => a + t.amount, 0);
  return { earned, withdrawn, balance, available: balance - heldByPending, pending: heldByPending };
}
export function enrichCourse(db: DB, c: any, enr?: any) {
  const total = courseLessons(c).length;
  return {
    id: c.id, title: c.title, subtitle: c.subtitle, image: c.image, category: c.category,
    level: c.level, access: c.access, status: c.status, instructorName: nameOf(db, c.instructorId),
    progress: enr && total ? Math.round((enr.completedLessons.length / total) * 100) : 0,
    completedLessons: enr?.completedLessons.length || 0, totalLessons: total,
    lastLessonId: enr?.lastLessonId, saved: !!enr?.saved, completedAt: enr?.completedAt,
    enrolledCount: db.enrollments.filter(e => e.courseId === c.id).length,
  };
}
export function studentData(db: DB, user: User) {
  const myEnr = db.enrollments.filter(e => e.studentId === user.id);
  const myCourses = myEnr.map(e => enrichCourse(db, db.courses.find(c => c.id === e.courseId)!, e)).filter(c => c.title);
  const sub = db.subscriptions.find(s => s.id === user.subscriptionId);
  const mySubs = db.submissions.filter(s => s.studentId === user.id).map(s => ({ ...s, assignmentTitle: db.assignments.find(a => a.id === s.assignmentId)?.title, courseTitle: db.courses.find(c => c.id === s.courseId)?.title, maxScore: db.assignments.find(a => a.id === s.assignmentId)?.maxScore }));
  const courseIds = myEnr.map(e => e.courseId);
  return {
    user: { ...publicUser(user), premiumActive: isPremiumActive(db, user) },
    stats: {
      enrolled: myEnr.length,
      completed: myCourses.filter(c => c.progress === 100).length,
      learningHours: Math.round((myEnr.reduce((a, e) => a + e.activeMin, 0) / 60) * 10) / 10,
      certificates: db.certificates.filter(c => c.studentId === user.id && !c.revoked).length,
      lessonsDone: myEnr.reduce((a, e) => a + e.completedLessons.length, 0),
    },
    myCourses, saved: myCourses.filter(c => c.saved), inProgress: myCourses.filter(c => c.progress > 0 && c.progress < 100), completed: myCourses.filter(c => c.progress === 100),
    assignments: db.assignments.filter(a => courseIds.includes(a.courseId)).map(a => ({ ...a, courseTitle: db.courses.find(c => c.id === a.courseId)?.title, submission: mySubs.find(s => s.assignmentId === a.id) || null })),
    submissions: mySubs,
    quizzes: db.quizzes.filter(q => courseIds.includes(q.courseId)).map(q => ({ id: q.id, title: q.title, courseId: q.courseId, courseTitle: db.courses.find(c => c.id === q.courseId)?.title, timeLimitMin: q.timeLimitMin, maxAttempts: q.maxAttempts, attempts: db.quizAttempts.filter(a => a.quizId === q.id && a.studentId === user.id) })),
    certificates: db.certificates.filter(c => c.studentId === user.id).map(c => ({ ...c, courseTitle: db.courses.find(x => x.id === c.courseId)?.title, instructorName: nameOf(db, db.courses.find(x => x.id === c.courseId)?.instructorId || "") })),
    subscription: sub || null,
    payments: db.payments.filter(p => p.studentId === user.id),
    notifications: db.notifications.filter(n => n.userId === user.id).slice(0, 30),
    goals: db.goals.filter(g => g.studentId === user.id),
    recommended: db.courses.filter(c => c.status === "published" && !courseIds.includes(c.id)).slice(0, 4).map(c => enrichCourse(db, c)),
    announcements: db.announcements.filter(a => ["all-students", "everyone"].includes(a.audience)).slice(0, 5),
    settings: db.settings,
    teachers: db.users.filter(u => u.role === "teacher" && u.status === "verified").map(u => ({ id: u.id, fullName: u.fullName, title: u.title })),
  };
}
export function teacherData(db: DB, user: User) {
  const myCourses = db.courses.filter(c => c.instructorId === user.id);
  const myCourseIds = myCourses.map(c => c.id);
  const myEnr = db.enrollments.filter(e => myCourseIds.includes(e.courseId));
  const w = wallet(db, user.id);
  return {
    user: publicUser(user),
    stats: {
      courses: myCourses.length, published: myCourses.filter(c => c.status === "published").length,
      drafts: myCourses.filter(c => c.status === "draft").length,
      students: new Set(myEnr.map(e => e.studentId)).size,
      completions: myEnr.filter(e => e.completedAt).length,
      completionRate: myEnr.length ? Math.round((myEnr.filter(e => e.completedAt).length / myEnr.length) * 100) : 0,
      avgRating: (() => { const rs = db.reviews.filter(r => myCourseIds.includes(r.courseId)); return rs.length ? Math.round((rs.reduce((a, r) => a + r.rating, 0) / rs.length) * 10) / 10 : null; })(),
    },
    courses: myCourses.map(c => ({ ...enrichCourse(db, c), moderationNote: c.moderationNote })),
    students: myEnr.map(e => ({ enrollmentId: e.id, studentId: e.studentId, studentName: nameOf(db, e.studentId), courseTitle: db.courses.find(c => c.id === e.courseId)?.title, progress: enrichCourse(db, db.courses.find(c => c.id === e.courseId)!, e).progress, activeMin: e.activeMin })),
    submissionsToGrade: db.submissions.filter(s => myCourseIds.includes(s.courseId)).map(s => ({ ...s, studentName: nameOf(db, s.studentId), assignmentTitle: db.assignments.find(a => a.id === s.assignmentId)?.title, courseTitle: db.courses.find(c => c.id === s.courseId)?.title })),
    wallet: w, walletTxs: db.walletTxs.filter(t => t.teacherId === user.id),
    withdrawals: db.withdrawals.filter(x => x.teacherId === user.id),
    notifications: db.notifications.filter(n => n.userId === user.id).slice(0, 30),
    reviews: db.reviews.filter(r => myCourseIds.includes(r.courseId)).map(r => ({ ...r, studentName: nameOf(db, r.studentId), courseTitle: db.courses.find(c => c.id === r.courseId)?.title })),
    revenuePeriods: db.revenuePeriods,
    settings: db.settings,
  };
}
export function adminData(db: DB, user: User) {
  const monthPayments = db.payments.filter(p => p.status === "completed");
  return {
    user: publicUser(user),
    stats: {
      students: db.users.filter(u => u.role === "student").length,
      verifiedStudents: db.users.filter(u => u.role === "student" && u.status === "verified").length,
      teachers: db.users.filter(u => u.role === "teacher").length,
      verifiedTeachers: db.users.filter(u => u.role === "teacher" && u.status === "verified").length,
      pendingTeachers: db.users.filter(u => u.role === "teacher" && u.status === "pending").length,
      pendingAdministrators: db.users.filter(u => u.role === "administrator" && u.status === "pending").length,
      publishedCourses: db.courses.filter(c => c.status === "published").length,
      coursesInReview: db.courses.filter(c => c.status === "in_review").length,
      activeSubscriptions: db.subscriptions.filter(s => s.status === "active" && new Date(s.expiresAt).getTime() > Date.now()).length,
      expiredSubscriptions: db.subscriptions.filter(s => s.status !== "active" || new Date(s.expiresAt).getTime() <= Date.now()).length,
      revenueKES: monthPayments.reduce((a, p) => a + p.amount, 0),
      failedPayments: db.payments.filter(p => p.status === "failed").length,
      openReports: db.reports.filter(r => r.status === "open").length,
      pendingWithdrawals: db.withdrawals.filter(w => w.status === "pending").length,
    },
    users: db.users.filter(u => u.role !== "owner").map(u => publicUser(u)),
    courses: db.courses.map(c => ({ ...enrichCourse(db, c), moderationNote: c.moderationNote })),
    payments: db.payments.map(p => ({ ...p, studentName: nameOf(db, p.studentId) })),
    subscriptions: db.subscriptions.map(s => ({ ...s, studentName: nameOf(db, s.studentId) })),
    withdrawals: db.withdrawals.map(w => ({ ...w, teacherName: nameOf(db, w.teacherId), available: wallet(db, w.teacherId).available })),
    revenuePeriods: db.revenuePeriods,
    auditLogs: db.auditLogs.slice(0, 60).map(a => ({ ...a, actorName: nameOf(db, a.actorId) })),
    verifications: db.verifications.slice(0, 40).map(v => ({ ...v, userName: nameOf(db, v.userId), decidedByName: v.decidedBy === "system" ? "System (automatic)" : nameOf(db, v.decidedBy) })),
    reports: db.reports.map(r => ({ ...r, reporterName: nameOf(db, r.reporterId) })),
    notifications: db.notifications.filter(n => n.userId === user.id).slice(0, 30),
    announcements: db.announcements,
    certificates: db.certificates.map(c => ({ ...c, studentName: nameOf(db, c.studentId), courseTitle: db.courses.find(x => x.id === c.courseId)?.title })),
    settings: db.settings,
  };
}
