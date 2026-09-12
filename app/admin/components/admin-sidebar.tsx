"use client";

export type AdminTab = "dashboard" | "users" | "classes" | "bindings" | "audit";

const TAB_LABELS: Record<AdminTab, string> = {
  dashboard: "仪表盘",
  users: "用户管理",
  classes: "班级管理",
  bindings: "绑定关系",
  audit: "审计日志",
};

interface AdminSidebarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  adminName: string;
  onLogout: () => void;
}

export function AdminSidebar({
  activeTab,
  onTabChange,
  adminName,
  onLogout,
}: AdminSidebarProps) {
  return (
    <aside className="flex w-56 shrink-0 flex-col space-y-3 border-r border-border bg-neutral-2 p-4">
      <h1 className="font-serif text-title-24 font-medium text-neutral-10">
        管理端
      </h1>
      <p className="text-copy-13 text-neutral-7">{adminName}</p>

      <nav className="mt-4 space-y-1">
        <p className="text-label-12 font-medium text-neutral-6">导航</p>
        {(Object.keys(TAB_LABELS) as AdminTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`block w-full rounded-lg px-3 py-2 text-left text-copy-14 transition-all duration-fast ease-standard active:scale-[0.98] ${
              activeTab === tab
                ? "bg-accent text-white"
                : "text-neutral-9 hover:bg-neutral-3"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </nav>

      <div className="mt-auto">
        <button
          onClick={onLogout}
          className="block w-full rounded-lg px-3 py-2 text-left text-copy-14 text-neutral-7 transition-all duration-fast ease-standard hover:bg-neutral-3 active:scale-[0.98]"
        >
          退出登录
        </button>
      </div>
    </aside>
  );
}
