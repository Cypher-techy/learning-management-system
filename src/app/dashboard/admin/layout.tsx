"use client";
import DashboardShell from "@/components/DashboardShell";
import { LayoutDashboard, Users, GraduationCap, BookOpenCheck, Landmark, Flag, Megaphone, ScrollText, Settings } from "lucide-react";
const NAV = [
  { href: "/dashboard/admin", label: "Overview", icon: <LayoutDashboard size={18} /> },
  { href: "/dashboard/admin/users", label: "Students & Users", icon: <Users size={18} /> },
  { href: "/dashboard/admin/teachers", label: "Teacher Verification", icon: <GraduationCap size={18} /> },
  { href: "/dashboard/admin/courses", label: "Course Moderation", icon: <BookOpenCheck size={18} /> },
  { href: "/dashboard/admin/finance", label: "Finance & Payouts", icon: <Landmark size={18} /> },
  { href: "/dashboard/admin/reports", label: "Reports", icon: <Flag size={18} /> },
  { href: "/dashboard/admin/announcements", label: "Announcements", icon: <Megaphone size={18} /> },
  { href: "/dashboard/admin/audit", label: "Audit Logs", icon: <ScrollText size={18} /> },
  { href: "/dashboard/admin/settings", label: "Settings", icon: <Settings size={18} /> },
];
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardShell nav={NAV} roleLabel="Administrator" expected="admin">{children}</DashboardShell>;
}
