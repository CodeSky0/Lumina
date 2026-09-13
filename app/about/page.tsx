"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { EASE } from "@/lib/motion";

const AVATAR_URL =
  "https://i.see.you/2026/04/06/mW3p/e687dcf361b90e15258af06410e4df9e.jpg";
const VERSION = "0.1.0-alpha";

const BACK_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </svg>
);

export default function AboutPage() {
  const router = useRouter();

  return (
    <div className="relative min-h-screen overflow-hidden bg-neutral-1">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl px-6 py-10 md:py-16">
        <button
          onClick={() => router.back()}
          className="mb-8 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-copy-14 text-neutral-6 transition-colors hover:bg-neutral-2 hover:text-neutral-9"
        >
          {BACK_ICON}
          <span>返回</span>
        </button>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE.out }}
          className="mb-10"
        >
          <h1 className="font-serif text-display-48 font-medium tracking-tight text-neutral-10">
            Lumina 流光
          </h1>
          <div className="mt-3 flex items-center gap-2">
            <Badge tone="accent">版本 {VERSION}</Badge>
            <Badge tone="neutral">alpha</Badge>
          </div>
          <p className="mt-4 text-copy-15 text-neutral-7">
            为深圳市宝安中学定制的实时家校沟通平台。
          </p>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE.out, delay: 0.08 }}
          className="mb-6 rounded-xl bg-neutral-2 p-6 ring-1 ring-border"
        >
          <h2 className="mb-4 font-serif text-title-20 font-medium text-neutral-9">
            开发者
          </h2>
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={AVATAR_URL}
              alt="咸鱼 (CodeSky) 的头像"
              loading="lazy"
              className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-accent/30"
            />
            <div className="min-w-0">
              <p className="font-serif text-title-20 font-medium text-neutral-10">
                咸鱼<span className="text-neutral-6"> (CodeSky)</span>
              </p>
              <p className="mt-1 text-copy-14 text-neutral-7">
                深圳市宝安中学高中部
              </p>
              <p className="text-copy-14 text-neutral-7">高一 (3) 班</p>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE.out, delay: 0.16 }}
          className="mb-6 rounded-xl bg-neutral-2 p-6 ring-1 ring-border"
        >
          <h2 className="mb-4 font-serif text-title-20 font-medium text-neutral-9">
            关于项目
          </h2>
          <p className="text-copy-15 leading-relaxed text-neutral-7">
            Lumina（流光）是为深圳市宝安中学定制的通讯软件，连接教师、教室大屏与家长三端，让校园沟通更高效、更温暖。
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <span className="text-copy-14 text-neutral-6">开源协议</span>
              <Badge tone="neutral">MIT</Badge>
            </div>
            <a
              href="https://github.com/CodeSky0/Lumina"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-copy-14 text-accent transition-opacity hover:opacity-80"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
              <span>GitHub</span>
            </a>
          </div>
        </motion.section>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE.out, delay: 0.24 }}
          className="text-center text-copy-13 text-neutral-5"
        >
          © 2026 Lumina · 用 ♥ 编码
        </motion.p>
      </div>
    </div>
  );
}
