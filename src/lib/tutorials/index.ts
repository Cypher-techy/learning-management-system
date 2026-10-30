import type { Assignment, Course, Quiz } from "../db";
import { officeCourses, officeQuizzes, officeAssignments } from "./office";
import { htmlCourse, webQuizzes, webAssignments } from "./web";

/** Free W3Schools-style tutorial catalogue (Windows, MS Office, Web Foundations). */
export const TUTORIAL_COURSES: Course[] = [...officeCourses, htmlCourse];
export const TUTORIAL_QUIZZES: Quiz[] = [...officeQuizzes, ...webQuizzes];
export const TUTORIAL_ASSIGNMENTS: Assignment[] = [...officeAssignments, ...webAssignments];
