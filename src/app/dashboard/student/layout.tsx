"use client";
import DashboardShell from "@/components/DashboardShell";
import { LayoutDashboard, BookOpen, ClipboardList, HelpCircle, Trophy, MessageSquare, Mail, CalendarClock, Crown, Settings, Compass } from "lucide-react";
const NAV = [
  { href: "/dashboard/student", label: "Overview", icon: <LayoutDashboard size={18} /> },
  { href: "/dashboard/student/learning", label: "My Learning", icon: <BookOpen size={18} /> },
  { href: "/explore", label: "Discover Courses", icon: <Compass size={18} /> },
  { href: "/dashboard/student/assignments", label: "Assignments", icon: <ClipboardList size={18} /> },
  { href: "/dashboard/student/quizzes", label: "Quizzes & Results", icon: <HelpCircle size={18} /> },
  { href: "/dashboard/student/certificates", label: "Certificates", icon: <Trophy size={18} /> },
  { href: "/dashboard/student/community", label: "Community", icon: <MessageSquare size={18} /> },
  { href: "/dashboard/student/messages", label: "Messages", icon: <Mail size={18} /> },
  { href: "/dashboard/student/planner", label: "Study Planner", icon: <CalendarClock size={18} /> },
  { href: "/dashboard/student/subscription", label: "Subscription", icon: <Crown size={18} /> },
  { href: "/dashboard/student/settings", label: "Settings", icon: <Settings size={18} /> },
];
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardShell nav={NAV} roleLabel="Student" expected="student">{children}</DashboardShell>;
}
