"use client";
import DashboardShell from "@/components/DashboardShell";
import { LayoutDashboard, BookOpen, PlusCircle, Users, Wallet, BarChart3, Mail, Settings } from "lucide-react";
const NAV = [
  { href: "/dashboard/tutor", label: "Overview", icon: <LayoutDashboard size={18} /> },
  { href: "/dashboard/tutor/courses", label: "My Courses", icon: <BookOpen size={18} /> },
  { href: "/dashboard/tutor/courses/new", label: "Create Course", icon: <PlusCircle size={18} /> },
  { href: "/dashboard/tutor/students", label: "Students & Grading", icon: <Users size={18} /> },
  { href: "/dashboard/tutor/earnings", label: "Earnings Wallet", icon: <Wallet size={18} /> },
  { href: "/dashboard/tutor/analytics", label: "Analytics", icon: <BarChart3 size={18} /> },
  { href: "/dashboard/tutor/messages", label: "Messages", icon: <Mail size={18} /> },
  { href: "/dashboard/tutor/settings", label: "Settings", icon: <Settings size={18} /> },
];
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardShell nav={NAV} roleLabel="Tutor" expected="tutor">{children}</DashboardShell>;
}
