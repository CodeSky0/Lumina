"use client";

import { useState, useEffect } from "react";
import { subscribeToPush } from "@/lib/push/actions";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function PushSubscribe() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      VAPID_PUBLIC_KEY
    ) {
      setSupported(true);
      setPermission(Notification.permission);

      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          if (sub) setSubscribed(true);
        })
        .catch(() => {});
    }
  }, []);

  async function handleSubscribe() {
    if (!supported) return;
    setLoading(true);

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        setSubscribed(true);
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
      });

      const res = await subscribeToPush(sub.toJSON());
      if (res.ok) setSubscribed(true);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  if (!supported || subscribed || permission === "denied") return null;

  return (
    <button
      onClick={handleSubscribe}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-label-12 text-neutral-6 transition-colors hover:bg-neutral-2 hover:text-neutral-9"
      title="开启浏览器推送通知"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {loading ? "订阅中…" : "开启推送"}
    </button>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
