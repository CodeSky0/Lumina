"use client";

import { useCallback, useEffect, useState } from "react";
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

  const refresh = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        listUsers(),
        listSubjects(),
        listClasses(),
        listTeacherClassBindings(),
        listParentStudentBindings(),
      ]);
      if (results[0].status === "fulfilled") setUsers(results[0].value);
      if (results[1].status === "fulfilled") setSubjects(results[1].value);
      if (results[2].status === "fulfilled") setClasses(results[2].value);
      if (results[3].status === "fulfilled") setTeacherBindings(results[3].value);
      if (results[4].status === "fulfilled") setParentBindings(results[4].value);
    } catch {
      /* 静默处理，避免整个面板崩溃 */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    void refresh();
  }, [refresh]);

  async function handleLogout() {
    await authClient.signOut();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- logout 后强制刷新清除所有客户端状态
    window.location.href = "/admin/login";
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <AdminSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          adminName={adminName}
          onLogout={handleLogout}
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
