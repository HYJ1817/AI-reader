import { describe, expect, it, vi } from "vitest";
import { createAppUpdateController } from "./appUpdate";

function scenario() {
  const controller = createAppUpdateController("running");
  const actions = { confirm: vi.fn(async () => true), flush: vi.fn(async () => {}), activate: vi.fn(async () => {}), reload: vi.fn() };
  controller.discover("candidate");
  return { controller, actions };
}

describe("user controlled app updates", () => {
  it("bounds generation draining without reloading after timeout", async () => {
    vi.useFakeTimers();
    try {
      const { controller, actions } = scenario();
      controller.protect("ai", { label: "AI", busy: true, stop: () => new Promise(() => {}) });
      const update = controller.request(actions);
      await vi.advanceTimersByTimeAsync(10_000);
      await update;
      expect(actions.reload).not.toHaveBeenCalled();
      expect(controller.getSnapshot().updating).toBe(false);
    } finally { vi.useRealTimers(); }
  });
  it("keeps candidate separate from running and snoozes only the chosen build", () => {
    const { controller } = scenario();
    controller.defer();
    controller.discover("candidate");
    expect(controller.getSnapshot()).toMatchObject({ runningBuild: "running", candidateBuild: "candidate", deferredBuild: "candidate", updating: false });
    controller.discover("next");
    expect(controller.getSnapshot().candidateBuild).toBe("next");
    expect(controller.getSnapshot().deferredBuild).toBe("candidate");
  });
  it("does not announce initial installation or reload on discovery", () => {
    const controller = createAppUpdateController("running");
    controller.discover("running");
    expect(controller.getSnapshot().candidateBuild).toBeNull();
  });
  it("waits for an import rather than interrupting it", async () => {
    const { controller, actions } = scenario();
    controller.protect("import", { label: "导入", busy: true });
    await controller.request(actions);
    expect(actions.confirm).not.toHaveBeenCalled();
    expect(actions.flush).not.toHaveBeenCalled();
    expect(actions.reload).not.toHaveBeenCalled();
    expect(controller.getSnapshot().error).toContain("导入");
  });
  it("keeps dirty provider/question drafts if confirmation is cancelled", async () => {
    const { controller, actions } = scenario();
    controller.protect("draft", { label: "服务商设置", dirty: true });
    actions.confirm.mockResolvedValue(false);
    await controller.request(actions);
    expect(actions.confirm).toHaveBeenCalledWith(expect.stringContaining("服务商设置"));
    expect(actions.reload).not.toHaveBeenCalled();
    expect(controller.getSnapshot().updating).toBe(false);
  });
  it("stops and drains generation before flush, activates then reloads once", async () => {
    const { controller, actions } = scenario();
    const sequence: string[] = [];
    controller.protect("ai", { label: "AI", busy: true, stop: async () => { sequence.push("stop"); } });
    actions.flush.mockImplementation(async () => { sequence.push("flush"); });
    actions.activate.mockImplementation(async () => { sequence.push("activate"); });
    actions.reload.mockImplementation(() => { sequence.push("reload"); });
    await Promise.all([controller.request(actions), controller.request(actions)]);
    expect(sequence).toEqual(["stop", "flush", "activate", "reload"]);
    expect(actions.reload).toHaveBeenCalledOnce();
  });
  it("does not activate or reload after persistence failure and allows retry", async () => {
    const { controller, actions } = scenario();
    actions.flush.mockRejectedValueOnce(new Error("disk full"));
    await controller.request(actions);
    expect(actions.activate).not.toHaveBeenCalled();
    expect(actions.reload).not.toHaveBeenCalled();
    expect(controller.getSnapshot().error).toContain("未保存");
    await controller.request(actions);
    expect(actions.reload).toHaveBeenCalledOnce();
  });
  it("rechecks transfer blockers after asynchronous confirmation", async () => {
    const { controller, actions } = scenario();
    controller.protect("draft", { label: "问题", dirty: true });
    actions.confirm.mockImplementation(async () => {
      controller.protect("restore", { label: "恢复", busy: true });
      return true;
    });
    await controller.request(actions);
    expect(actions.reload).not.toHaveBeenCalled();
  });
});
