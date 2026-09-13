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
          <dl className="mt-5 divide-y divide-border border-t border-border">
            <div className="flex justify-between py-2.5">
              <dt className="text-copy-14 text-neutral-6">版本</dt>
              <dd className="text-copy-14 font-medium text-neutral-9">{VERSION}</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-copy-14 text-neutral-6">开发者</dt>
              <dd className="text-copy-14 font-medium text-neutral-9">咸鱼 (CodeSky)</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-copy-14 text-neutral-6">就读学校</dt>
              <dd className="text-copy-14 font-medium text-neutral-9">深圳市宝安中学高中部</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-copy-14 text-neutral-6">班级</dt>
              <dd className="text-copy-14 font-medium text-neutral-9">高一 (3) 班</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-copy-14 text-neutral-6">用途</dt>
              <dd className="text-copy-14 font-medium text-neutral-9">宝中定制通讯</dd>
            </div>
          </dl>
        </motion.section>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE.out, delay: 0.24 }}
          className="text-center text-copy-13 text-neutral-5"
        >
          © 2026 Lumina · 由咸鱼倾力打造
        </motion.p>
      </div>
    </div>
  );
}
