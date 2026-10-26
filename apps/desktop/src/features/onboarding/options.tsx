import { BarChart3, BookOpen, Code2, Globe, GraduationCap, HardDrive, Layers, ShieldCheck, User } from "lucide-react";
import type { ReactNode } from "react";
import type { Experience, Role, UseCase } from "../../lib/bindings";

export const STEPS = ["Welcome", "About you", "Usage", "PostgreSQL", "Ready"];

export const ROLES: Record<Role, { label: string; icon: ReactNode }> = {
  developer: { label: "Developer", icon: <Code2 /> },
  analyst: { label: "Data / Analyst", icon: <BarChart3 /> },
  dba: { label: "Database admin", icon: <ShieldCheck /> },
  student: { label: "Student", icon: <GraduationCap /> },
  other: { label: "Other", icon: <User /> },
};

export const USE_CASES: Record<UseCase, { label: string; description: string; icon: ReactNode }> = {
  local_dev: { label: "Local development", description: "Postgres on this computer", icon: <HardDrive /> },
  remote: { label: "Remote servers", description: "Cloud or hosted databases", icon: <Globe /> },
  both: { label: "Both", description: "Local and remote", icon: <Layers /> },
  learning: { label: "Learning SQL", description: "A safe place to practice", icon: <BookOpen /> },
};

export interface Answers {
  name: string;
  role: Role;
  experience: Experience;
  useCase: UseCase;
  telemetry: boolean;
}
