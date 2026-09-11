"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { authClient } from "@/lib/auth/client";
import {
  listClasses,
  listParentStudentBindings,
  listTeacherClassBindings,
  listUsers,
  type ClassListItem,
  type ParentStudentBinding,
  type TeacherClassBinding,
  type UserListItem,
} from "@/lib/admin/actions";
import { ToastProvider } from "@/components/ui";
import { AdminSidebar, type AdminTab } from "./components/admin-sidebar";
import { UsersTab } from "./tabs/users-tab";
import { ClassesTab } from "./tabs/classes-tab";
import { BindingsTab } from "./tabs/bindings-tab";

interface AdminPanelProps {
  adminName: string;
}

export default function AdminPanel({ adminName }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [classes, setClasses] = useState<ClassListItem[]>([]);
  const [teacherBindings, setTeacherBindings] = useState<TeacherClassBinding[]>(
    [],
  );
  const [parentBindings, setParentBindings] = useState<ParentStudentBinding[]>(
    [],
  );

  async function refresh() {
    const [u, c, tb, pb] = await Promise.all([
      listUsers(),
      listClasses(),
      listTeacherClassBindings(),
      listParentStudentBindings(),
    ]);
    setUsers(u);
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
              {activeTab === "users" && (
                <UsersTab users={users} classes={classes} onRefresh={refresh} />
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
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </ToastProvider>
  );
}
