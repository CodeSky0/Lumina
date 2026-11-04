// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUrgentAudio } from "@/components/classroom/use-urgent-audio";

const starts = vi.hoisted(() => vi.fn());

class MockAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
  createOscillator() {
    return { type: "", frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn(), start: starts, stop: vi.fn(), addEventListener: vi.fn() };
  }
  createGain() {
    return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
  }
}

afterEach(() => {
  cleanup();
  starts.mockClear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("紧急提示音", () => {
  it("不同紧急 ID 会重新响铃，相同 ID 不重复触发", async () => {
    vi.stubGlobal("AudioContext", MockAudioContext);
    const { result, rerender } = renderHook(({ id }: { id?: string }) => useUrgentAudio(id), { initialProps: { id: "urgent-1" } });
    await act(async () => result.current.unlock());
    expect(starts).toHaveBeenCalledTimes(1);

    rerender({ id: "urgent-2" });
    expect(starts).toHaveBeenCalledTimes(2);
    rerender({ id: "urgent-2" });
    expect(starts).toHaveBeenCalledTimes(2);
  });

  it("提示音循环播放，紧急项关闭后停止", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", MockAudioContext);
    const { result, rerender } = renderHook(({ id }: { id?: string }) => useUrgentAudio(id), { initialProps: { id: "urgent-1" as string | undefined } });
    await act(async () => result.current.unlock());
    expect(starts).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(900); });
    expect(starts).toHaveBeenCalledTimes(2);

    rerender({ id: undefined });
    act(() => { vi.advanceTimersByTime(1800); });
    expect(starts).toHaveBeenCalledTimes(2);
  });
});
