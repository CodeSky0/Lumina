"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { authClient } from "@/lib/auth/client";
import {
  listClasses,
  listParentStudentBindings,
  listSubjects,
  listTeacherClassBindings,
  listUsers,
  type ClassListItem,
  type ParentStudentBinding,
  type SubjectListItem,
  type TeacherClassBinding,
  type UserListItem,
} from "@/lib/admin/actions";
import { ToastProvider } from "@/components/ui";
import { AdminSidebar, type AdminTab } from "./components/admin-sidebar";
import { DashboardTab } from "./tabs/dashboard-tab";
import { UsersTab } from "./tabs/users-tab";
import { SubjectsTab } from "./tabs/subjects-tab";
import { ClassesTab } from "./tabs/classes-tab";
import { BindingsTab } from "./tabs/bindings-tab";
import { AuditTab } from "./tabs/audit-tab";

interface AdminPanelProps {
  adminName: string;
}

export default function AdminPanel({ adminName }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectListItem[]>([]);
  const [classes, setClasses] = useState<ClassListItem[]>([]);
  const [teacherBindings, setTeacherBindings] = useState<TeacherClassBinding[]>(
    [],
  );
  const [parentBindings, setParentBindings] = useState<ParentStudentBinding[]>(
    [],
  );

  async function refresh() {
    const [u, s, c, tb, pb] = await Promise.all([
      listUsers(),
      listSubjects(),
      listClasses(),
      listTeacherClassBindings(),
      listParentStudentBindings(),
    ]);
    setUsers(u);
    setSubjects(s);
    setClasses(c);
    setTeacherBindings(tb);
    setParentBindings(pb);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <AdminSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          adminName={adminName}
          onLogout={() => authClient.signOut()}
        />
        <main className="flex-1 overflow-x-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === "dashboard" && <DashboardTab />}
              {activeTab === "users" && (
                <UsersTab users={users} subjects={subjects} classes={classes} onRefresh={refresh} />
              )}
              {activeTab === "subjects" && (
                <SubjectsTab subjects={subjects} onRefresh={refresh} />
              )}
              {activeTab === "classes" && (
                <ClassesTab classes={classes} onRefresh={refresh} />
              )}
              {activeTab === "bindings" && (
                <BindingsTab
                  users={users}
                  classes={classes}
                  teacherBindings={teacherBindings}
                  parentBindings={parentBindings}
                  onRefresh={refresh}
                />
              )}
              {activeTab === "audit" && <AuditTab />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </ToastProvider>
  );
}
