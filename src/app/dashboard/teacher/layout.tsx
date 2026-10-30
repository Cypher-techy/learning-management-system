"use client";
import DashboardShell from "@/components/DashboardShell";
import { LayoutDashboard, BookOpen, PlusCircle, Users, Wallet, BarChart3, Mail, Settings } from "lucide-react";
const NAV = [
  { href: "/dashboard/teacher", label: "Overview", icon: <LayoutDashboard size={18} /> },
  { href: "/dashboard/teacher/courses", label: "My Courses", icon: <BookOpen size={18} /> },
  { href: "/dashboard/teacher/courses/new", label: "Create Course", icon: <PlusCircle size={18} /> },
  { href: "/dashboard/teacher/students", label: "Students & Grading", icon: <Users size={18} /> },
  { href: "/dashboard/teacher/earnings", label: "Earnings Wallet", icon: <Wallet size={18} /> },
  { href: "/dashboard/teacher/analytics", label: "Analytics", icon: <BarChart3 size={18} /> },
  { href: "/dashboard/teacher/messages", label: "Messages", icon: <Mail size={18} /> },
  { href: "/dashboard/teacher/settings", label: "Settings", icon: <Settings size={18} /> },
];
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardShell nav={NAV} roleLabel="Instructor" expected="teacher">{children}</DashboardShell>;
}
