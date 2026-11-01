import assert from "node:assert/strict";
import test from "node:test";
import {
  createGenerationHarness, plain, submitEvent, verifyGenerationPrintIntegration,
} from "./lib/create-generation-harness.mjs";

function workspace(context, options) {
  const harness = createGenerationHarness(options);
  context.after(() => harness.unmount());
  return harness;
}
const ids = (versions) => Array.from(versions, (version) => version.id);
const model = (harness) => harness.props("PreviewPanel").modelParams;
const history = (harness) => harness.props("VersionHistory");
function generate(harness, prompt = "연필꽂이") {
  harness.submit(prompt);
  harness.advance(1800);
  return harness.props("ChatPanel");
}

test("an accepted prompt invalidates a pending print check without blocking a new check", async (context) => {
  const harness = workspace(context);
  generate(harness);
  harness.props("PreviewPanel").onPrint();
  assert.equal(harness.queries.length, 1);
  harness.submit("새 디자인");
  harness.advance(1800);
  harness.props("PreviewPanel").onPrint();
  assert.equal(harness.queries.length, 2);
  harness.queries[1].resolve(null);
  await new Promise((done) => setImmediate(done));
  assert.equal(harness.props("PrintSettingsModal").isOpen, true);
  const updates = harness.stateUpdates;
  harness.queries[0].resolve({ id: 1, status: "PRINTING" });
  await new Promise((done) => setImmediate(done));
  assert.equal(harness.stateUpdates, updates);
  assert.equal(harness.props("PrintSettingsModal").isOpen, true);
  assert.equal(harness.props("PreviewPanel").isPrintStatusChecking, false);
});

test("first generation keeps message order, 1800 ms loading, three versions and v3 selection", (context) => {
  const harness = workspace(context);
  assert.equal(history(harness).selectedVersionId, "v3");
  assert.equal(history(harness).versions.length, 0);
  assert.equal(harness.props("PreviewPanel").isGenerated, false);
  harness.submit("  연필꽂이  ");
  let chat = harness.props("ChatPanel");
  assert.equal(chat.isLoading, true);
  assert.deepEqual(plain(chat.messages), [{ id: "message-2", role: "user", content: "연필꽂이" }]);
  harness.advance(1799);
  assert.equal(harness.props("ChatPanel").isLoading, true);
  assert.equal(history(harness).versions.length, 0);
  harness.advance(1);
  chat = harness.props("ChatPanel");
  assert.equal(chat.isLoading, false);
  assert.equal(chat.isGenerated, true);
  assert.deepEqual(Array.from(chat.messages, (message) => [message.id, message.role]),
    [["message-2", "user"], ["message-1", "assistant"]]);
  assert.equal(chat.messages[1].content,
    "육각형 연필꽂이를 생성했어요. 높이와 바닥 지름을 조정하면서 원하는 형태로 다듬어 보세요.");
  assert.deepEqual(ids(history(harness).versions), ["v1", "v2", "v3"]);
  assert.deepEqual(Array.from(history(harness).versions, (version) => version.label), ["v1", "v2", "v3"]);
  assert.equal(history(harness).selectedVersionId, "v3");
  assert.deepEqual(plain(model(harness)), {
    stlUrl: "/pencil-holder.stl", scale: [1.15, 1.05, 1.15], color: "#5a7bff",
    dimensions: { width: 92, height: 105, depth: 92 },
  });
  const firstMessages = Array.from(chat.messages);
  generate(harness, "크기를 바꿔줘");
  assert.deepEqual(ids(history(harness).versions), ["v1", "v2", "v3", "v4"]);
  assert.equal(history(harness).selectedVersionId, "v4");
  assert.equal(harness.props("ChatPanel").messages.length, 4);
  firstMessages.forEach((message, index) => assert.equal(harness.props("ChatPanel").messages[index], message));
});

for (const previousPrompt of ["연필꽂이", "얇은 연필꽂이"]) {
  test("copyright takes precedence and preserves selected result and blocking: " + previousPrompt, (context) => {
    const harness = workspace(context);
    generate(harness, previousPrompt);
    history(harness).onSelectVersion("v1");
    const previous = history(harness);
    const previousModel = model(harness);
    const blocked = harness.props("ChatPanel").isPrintBlocked;
    const chat = generate(harness, "PoKeMoN을 최대한 얇게");
    assert.equal(chat.messages.at(-1).isCopyrightIssue, true);
    assert.equal(chat.messages.at(-1).hasPrintIssue, undefined);
    assert.equal(chat.messages.at(-1).copyrightWarning.title, "이 요청은 만들어 드릴 수 없어요");
    assert.equal(history(harness).versions, previous.versions);
    assert.equal(history(harness).selectedVersionId, "v1");
    assert.equal(model(harness), previousModel);
    assert.equal(chat.isGenerated, true);
    assert.equal(chat.isPrintBlocked, blocked);
    chat.onAutoFix(chat.messages.at(-1).id);
    assert.equal(harness.props("ChatPanel").messages, chat.messages);
    assert.equal(history(harness).versions, previous.versions);
  });
}

test("a copyright-only first request creates no versions and does not consume version numbers", (context) => {
  const harness = workspace(context);
  const initialModel = model(harness);
  const chat = generate(harness, "피카츄");
  assert.equal(chat.isGenerated, false);
  assert.equal(chat.isPrintBlocked, false);
  assert.equal(model(harness), initialModel);
  assert.deepEqual(ids(history(harness).versions), []);
  generate(harness);
  assert.deepEqual(ids(history(harness).versions), ["v1", "v2", "v3"]);
});

test("print warning generates a model; same-render auto-fix adds exactly two messages and one version", (context) => {
  const harness = workspace(context);
  const warning = generate(harness, "얇게 만들어줘");
  assert.equal(warning.isGenerated, true);
  assert.equal(warning.isPrintBlocked, true);
  assert.equal(warning.messages.at(-1).hasPrintIssue, true);
  assert.deepEqual(ids(history(harness).versions), ["v1", "v2", "v3"]);
  const warningId = warning.messages.at(-1).id;
  warning.onAutoFix(warningId);
  warning.onAutoFix(warningId);
  const fixed = harness.props("ChatPanel");
  assert.equal(fixed.messages.length, 4);
  assert.equal(fixed.messages[1].isPrintIssueResolved, true);
  assert.equal(fixed.messages[2].content, "규격에 맞게 자동 수정");
  assert.equal(fixed.messages[2].role, "user");
  assert.equal(fixed.messages[3].role, "assistant");
  assert.deepEqual(Array.from(fixed.messages[3].printCorrection.issues, (issue) => issue.corrected),
    ["1.4 mm", "2.4 mm"]);
  assert.equal(fixed.isPrintBlocked, false);
  assert.equal(history(harness).selectedVersionId, "v4");
  assert.equal(model(harness).color, "#14b8a6");
  assert.deepEqual(ids(history(harness).versions), ["v1", "v2", "v3", "v4"]);
  fixed.onAutoFix(warningId);
  assert.equal(harness.props("ChatPanel").messages, fixed.messages);
  generate(harness);
  assert.deepEqual(ids(history(harness).versions), ["v1", "v2", "v3", "v4", "v5"]);
});

test("only the latest print warning can be fixed; loading, old and missing warnings are ignored", (context) => {
  const harness = workspace(context);
  const firstId = generate(harness, "얇은 모델").messages.at(-1).id;
  harness.submit("더 얇게");
  const loading = harness.props("ChatPanel");
  loading.onAutoFix(firstId);
  assert.equal(harness.props("ChatPanel").messages, loading.messages);
  harness.advance(1800);
  let chat = harness.props("ChatPanel");
  const currentId = chat.messages.at(-1).id;
  chat.onAutoFix(firstId);
  chat.onAutoFix("missing");
  assert.equal(harness.props("ChatPanel").messages, chat.messages);
  chat.onAutoFix(currentId);
  chat = harness.props("ChatPanel");
  assert.equal(chat.messages.length, 6);
  assert.equal(chat.messages[1].isPrintIssueResolved, undefined);
  assert.equal(chat.messages[3].isPrintIssueResolved, true);
  assert.equal(history(harness).selectedVersionId, "v5");
});

test("version selection updates the preview without changing print blocking; unknown IDs are ignored", (context) => {
  const harness = workspace(context);
  generate(harness, "얇은 모델");
  const previous = history(harness).versions;
  history(harness).onSelectVersion("v1");
  assert.equal(history(harness).selectedVersionId, "v1");
  assert.equal(model(harness).color, "#9ca3af");
  assert.deepEqual(plain(model(harness).scale), [1, 1, 1]);
  assert.equal(harness.props("PreviewPanel").isPrintBlocked, true);
  const selectedModel = model(harness);
  history(harness).onSelectVersion("missing");
  assert.equal(history(harness).selectedVersionId, "v1");
  assert.equal(model(harness), selectedModel);
  assert.equal(history(harness).versions, previous);
});

for (const desktop of [false, true]) {
  test("new chat resets results, numbering, camera and a pending timer; desktop=" + desktop, (context) => {
    const harness = workspace(context, { desktop });
    const initialModel = plain(model(harness));
    const chat = generate(harness, "얇은 모델");
    chat.onAutoFix(chat.messages.at(-1).id);
    harness.props("PreviewPanel").onZoom("in");
    harness.submit("다음 디자인");
    assert.equal(harness.timers.size, 1);
    harness.newChat();
    assert.equal(harness.timers.size, 0);
    const reset = harness.props("ChatPanel");
    assert.equal(reset.isLoading, false);
    assert.equal(reset.isGenerated, false);
    assert.equal(reset.isPrintBlocked, false);
    assert.equal(reset.messages.length, 0);
    assert.deepEqual(ids(history(harness).versions), []);
    assert.equal(history(harness).selectedVersionId, "v3");
    assert.deepEqual(plain(model(harness)), initialModel);
    assert.equal(harness.props("PreviewPanel").cameraDistance, 42);
    harness.advance(1800);
    assert.equal(harness.props("ChatPanel").messages.length, 0);
    generate(harness);
    assert.deepEqual(ids(history(harness).versions), ["v1", "v2", "v3"]);
  });
}

test("unmount cancels the pending generation timer", (context) => {
  const harness = workspace(context);
  harness.submit("연필꽂이");
  assert.equal(harness.timers.size, 1);
  harness.unmount();
  harness.advance(1800);
});

test("image-only messages keep filenames and do not treat filenames as copyright prompts", (context) => {
  const harness = workspace(context);
  harness.attach("pokemon.png");
  harness.props("ChatPanel").onSubmit(submitEvent());
  assert.equal(harness.props("ChatPanel").messages[0].content,
    "참고 이미지를 바탕으로 디자인을 만들어 주세요.\n참고 이미지: pokemon.png");
  assert.equal(harness.liveUrls.size, 0);
  harness.advance(1800);
  assert.equal(harness.props("ChatPanel").messages.at(-1).isCopyrightIssue, undefined);
  assert.deepEqual(ids(history(harness).versions), ["v1", "v2", "v3"]);
});

test("Workspace preserves IME and Shift+Enter while ordinary Enter requests form submission", (context) => {
  const harness = workspace(context);
  let submissions = 0;
  let prevented = 0;
  const event = {
    key: "Enter", shiftKey: false, nativeEvent: { isComposing: true },
    currentTarget: { form: { requestSubmit: () => submissions++ } },
    preventDefault: () => prevented++,
  };
  const chat = harness.props("ChatPanel");
  chat.onInputKeyDown(event);
  chat.onInputKeyDown({ ...event, nativeEvent: { isComposing: false }, shiftKey: true });
  assert.equal(submissions, 0);
  assert.equal(prevented, 0);
  chat.onInputKeyDown({ ...event, nativeEvent: { isComposing: false } });
  assert.equal(submissions, 1);
  assert.equal(prevented, 1);
});

test("accepted starts alone clear input, attachments and print setup; generation controls print eligibility",
  verifyGenerationPrintIntegration);

test("generation hook accepts prepared content and rejects empty or loading requests without side effects", (context) => {
  const harness = workspace(context, { hookOnly: true });
  let hook = harness.render();
  assert.equal(hook.startGeneration({ prompt: "", userContent: "  " }), false);
  assert.equal(harness.timers.size, 0);
  assert.equal(harness.render().messages.length, 0);
  assert.equal(hook.startGeneration({ prompt: "", userContent: "참고 이미지: sample.png" }), true);
  hook = harness.render();
  const messages = hook.messages;
  assert.equal(hook.isLoading, true);
  assert.equal(hook.startGeneration({ prompt: "다음 요청", userContent: "다음 요청" }), false);
  assert.equal(harness.render().messages, messages);
  assert.equal(harness.timers.size, 1);
  harness.advance(1800);
  hook = harness.render();
  assert.equal(hook.isLoading, false);
  assert.equal(hook.isGenerated, true);
  assert.deepEqual(ids(hook.versions), ["v1", "v2", "v3"]);
  hook.handleVersionSelect("v2");
  assert.equal(harness.render().currentModelParams.color, "#7c8cf8");
  hook.resetGeneration();
  hook = harness.render();
  assert.equal(hook.messages.length, 0);
  assert.equal(hook.versions.length, 0);
  assert.equal(hook.selectedVersionId, "v3");
  assert.equal(hook.isGenerated, false);
  assert.equal(hook.startGeneration({ prompt: "얇게", userContent: "얇게" }), true);
  harness.advance(1800);
  hook = harness.render();
  hook.handleAutoFix(hook.messages.at(-1).id);
  hook = harness.render();
  assert.equal(hook.isPrintBlocked, false);
  assert.deepEqual(ids(hook.versions), ["v1", "v2", "v3", "v4"]);
});

for (const prompt of ["연필꽂이", "pokemon 얇게", "얇은 연필꽂이"]) {
  test("same-render starts share one timer and release the lock after completion: " + prompt, (context) => {
    const harness = workspace(context, { hookOnly: true });
    const initial = harness.render();
    const request = { prompt, userContent: prompt };
    assert.equal(initial.startGeneration(request), true);
    const updates = harness.stateUpdates;
    assert.equal(initial.startGeneration(request), false);
    assert.equal(harness.stateUpdates, updates, "Rejected starts must not call any setter");
    assert.equal(harness.timers.size, 1);
    const scheduled = [...harness.timers.keys()];
    let hook = harness.render();
    const messages = hook.messages;
    const versions = hook.versions;
    assert.equal(messages.length, 1);
    assert.equal(messages[0].id, "message-2");
    assert.equal(versions.length, 0);
    for (let render = 0; render < 3; render++) {
      hook = harness.render();
      assert.equal(hook.isLoading, true);
      assert.equal(hook.startGeneration(request), false);
      assert.equal(hook.messages, messages);
      assert.equal(hook.versions, versions);
      assert.deepEqual([...harness.timers.keys()], scheduled);
      assert.equal(harness.stateUpdates, updates);
    }
    harness.advance(1800);
    hook = harness.render();
    assert.equal(hook.isLoading, false);
    assert.equal(harness.timers.size, 0);
    assert.equal(hook.messages.length, 2);
    assert.equal(hook.messages[1].id, "message-1");
    assert.equal(hook.isPrintBlocked, prompt === "얇은 연필꽂이");
    assert.deepEqual(ids(hook.versions), prompt.includes("pokemon") ? [] : ["v1", "v2", "v3"]);
    assert.equal(hook.startGeneration({ prompt: "다음 디자인", userContent: "다음 디자인" }), true);
    assert.equal(harness.render().messages.at(-1).id, "message-4", "Rejected starts must not consume IDs");
    harness.advance(1800);
    hook = harness.render();
    assert.equal(hook.messages.length, 4);
    assert.equal(hook.isPrintBlocked, false);
    assert.deepEqual(ids(hook.versions), prompt.includes("pokemon") ? ["v1", "v2", "v3"] : ["v1", "v2", "v3", "v4"]);
  });
}

for (const elapsed of [0, 1799]) {
  test("reset invalidates a cancelled callback and immediately admits a fresh request at " + elapsed + " ms", (context) => {
    const harness = workspace(context, { hookOnly: true });
    harness.render().startGeneration({ prompt: "얇은 이전 디자인", userContent: "이전 요청" });
    const cancelledCallback = [...harness.timers.values()][0].callback;
    harness.advance(elapsed);
    const pending = harness.render();
    assert.equal(pending.isLoading, true);
    pending.resetGeneration();
    assert.equal(harness.timers.size, 0);
    const resetUpdates = harness.stateUpdates;
    cancelledCallback();
    assert.equal(harness.stateUpdates, resetUpdates, "Cancelled callbacks must not call setters after reset");
    const reset = harness.render();
    assert.equal(reset.messages.length, 0);
    assert.equal(reset.versions.length, 0);
    assert.equal(reset.isLoading, false);
    assert.equal(reset.isGenerated, false);
    assert.equal(reset.isPrintBlocked, false);
    // Use the handler that captured isLoading=true, without needing a fresh closure.
    assert.equal(pending.startGeneration({ prompt: "새 디자인", userContent: "새 요청" }), true);
    const fresh = harness.render();
    const freshUpdates = harness.stateUpdates;
    const scheduled = [...harness.timers.keys()];
    cancelledCallback();
    assert.equal(harness.stateUpdates, freshUpdates);
    assert.equal(harness.render().messages, fresh.messages);
    assert.equal(harness.render().versions, fresh.versions);
    assert.equal(harness.render().isLoading, true);
    assert.deepEqual([...harness.timers.keys()], scheduled);
    assert.equal(pending.startGeneration({ prompt: "중복", userContent: "중복" }), false);
    harness.advance(1799);
    assert.equal(harness.render().isLoading, true);
    assert.equal(harness.render().messages.length, 1);
    harness.advance(1);
    const complete = harness.render();
    assert.equal(complete.messages.length, 2);
    assert.equal(complete.messages[0].content, "새 요청");
    assert.deepEqual(ids(complete.versions), ["v1", "v2", "v3"]);
    assert.equal(complete.isPrintBlocked, false);
    assert.equal(harness.timers.size, 0);
    const completeUpdates = harness.stateUpdates;
    cancelledCallback();
    assert.equal(harness.stateUpdates, completeUpdates);
  });
}

test("a completed callback cannot publish twice or release a newer request's lock", (context) => {
  const harness = workspace(context, { hookOnly: true });
  const initial = harness.render();
  initial.startGeneration({ prompt: "디자인", userContent: "디자인" });
  const completedCallback = [...harness.timers.values()][0].callback;
  harness.advance(1800);
  const completeUpdates = harness.stateUpdates;
  completedCallback();
  assert.equal(harness.stateUpdates, completeUpdates);
  assert.equal(initial.startGeneration({ prompt: "다음", userContent: "다음" }), true);
  const nextUpdates = harness.stateUpdates;
  completedCallback();
  assert.equal(harness.stateUpdates, nextUpdates);
  assert.equal(initial.startGeneration({ prompt: "중복", userContent: "중복" }), false);
  assert.equal(harness.timers.size, 1);
  harness.advance(1800);
  assert.equal(harness.render().messages.length, 4);
  assert.deepEqual(ids(harness.render().versions), ["v1", "v2", "v3", "v4"]);
});

test("unmount rejects delayed callbacks and retained start handlers without setters", (context) => {
  const harness = workspace(context, { hookOnly: true });
  const initial = harness.render();
  initial.startGeneration({ prompt: "이전", userContent: "이전" });
  const cancelledCallback = [...harness.timers.values()][0].callback;
  harness.unmount();
  assert.equal(harness.timers.size, 0);
  const updates = harness.stateUpdates;
  assert.doesNotThrow(cancelledCallback);
  assert.equal(initial.startGeneration({ prompt: "종료 후", userContent: "종료 후" }), false);
  assert.equal(harness.stateUpdates, updates);
  assert.equal(harness.timers.size, 0);
  const fresh = workspace(context, { hookOnly: true });
  fresh.render();
  fresh.replayMountEffects();
  assert.equal(fresh.render().startGeneration({ prompt: "새 마운트", userContent: "새 마운트" }), true);
  assert.doesNotThrow(cancelledCallback);
  assert.equal(harness.stateUpdates, updates);
  fresh.advance(1800);
  assert.deepEqual(ids(fresh.render().versions), ["v1", "v2", "v3"]);
});

test("effect replay cancels pending work, clears loading and permits a fresh task without reset", (context) => {
  const harness = workspace(context, { hookOnly: true });
  harness.render();
  harness.replayMountEffects();
  harness.replayMountEffects();
  assert.equal(harness.render().startGeneration({ prompt: "얇은 이전", userContent: "이전" }), true);
  const cancelledCallback = [...harness.timers.values()][0].callback;
  const pending = harness.render();
  harness.replayMountEffects(() => {
    const cleanupUpdates = harness.stateUpdates;
    cancelledCallback();
    assert.equal(harness.stateUpdates, cleanupUpdates);
    assert.equal(pending.startGeneration({ prompt: "cleanup 중", userContent: "cleanup 중" }), false);
  });
  assert.equal(harness.timers.size, 0);
  const idle = harness.render();
  assert.equal(idle.isLoading, false);
  assert.equal(idle.messages, pending.messages, "Effect replay does not reset chat history");
  assert.equal(pending.startGeneration({ prompt: "새 디자인", userContent: "새 디자인" }), true);
  const updates = harness.stateUpdates;
  cancelledCallback();
  assert.equal(harness.stateUpdates, updates);
  assert.equal(pending.startGeneration({ prompt: "중복", userContent: "중복" }), false);
  assert.equal(harness.timers.size, 1);
  harness.advance(1800);
  const complete = harness.render();
  assert.equal(complete.isLoading, false);
  assert.equal(complete.isPrintBlocked, false);
  assert.equal(complete.messages.length, 3);
  assert.equal(complete.messages[1].content, "새 디자인");
  assert.deepEqual(ids(complete.versions), ["v1", "v2", "v3"]);
});

for (const failure of ["assistant ID", "user ID", "timer registration"]) {
  test("synchronous start errors release ownership and preserve state: " + failure, (context) => {
    const expectedError = new Error("Injected " + failure + " failure");
    let uuidCalls = 0;
    let failOnce = true;
    const harness = workspace(context, {
      hookOnly: true,
      beforeRandomUUID() {
        uuidCalls += 1;
        if (failOnce && uuidCalls === (failure === "assistant ID" ? 1 : failure === "user ID" ? 2 : -1)) {
          failOnce = false;
          throw expectedError;
        }
      },
      beforeSetTimeout() {
        if (failOnce && failure === "timer registration") {
          failOnce = false;
          throw expectedError;
        }
      },
    });
    const initial = harness.render();
    const request = { prompt: "디자인", userContent: "디자인" };
    const before = harness.stateUpdates;
    assert.throws(() => initial.startGeneration(request), (error) => error === expectedError);
    assert.equal(harness.timers.size, 0);
    const failed = harness.render();
    const afterFailure = harness.stateUpdates;
    // Check retry first so a leaked admission lock is reported directly.
    assert.equal(initial.startGeneration(request), true, "A failed start must not retain its lock");
    assert.equal(failed.messages, initial.messages);
    assert.equal(failed.versions, initial.versions);
    assert.equal(failed.currentModelParams, initial.currentModelParams);
    assert.equal(failed.isLoading, false);
    assert.equal(afterFailure, before, "A failed start must not publish state");
    assert.equal(harness.timers.size, 1);
    harness.advance(1800);
    assert.equal(harness.render().messages.length, 2);
    assert.deepEqual(ids(harness.render().versions), ["v1", "v2", "v3"]);
  });
}

test("Workspace preserves input, attachments, results and print setup after a scheduling error", async (context) => {
  let failNextTimer = false;
  const expectedError = new Error("Injected timer registration failure");
  const harness = workspace(context, {
    beforeSetTimeout() {
      if (failNextTimer) {
        failNextTimer = false;
        throw expectedError;
      }
    },
  });
  generate(harness);
  harness.props("PreviewPanel").onPrint();
  harness.queries.at(-1).resolve(null);
  await new Promise((done) => setImmediate(done));
  assert.equal(harness.props("PrintSettingsModal").isOpen, true);
  harness.attach("keep.png");
  harness.props("ChatPanel").onDraftChange("보존할 입력");
  const before = harness.props("ChatPanel");
  const versions = history(harness).versions;
  const previousModel = model(harness);
  const updates = harness.stateUpdates;
  failNextTimer = true;
  assert.throws(() => before.onSubmit(submitEvent()), (error) => error === expectedError);
  assert.equal(harness.stateUpdates, updates);
  const failed = harness.props("ChatPanel");
  assert.equal(failed.messages, before.messages);
  assert.equal(failed.draft, before.draft);
  assert.equal(failed.attachedImages, before.attachedImages);
  assert.equal(failed.isLoading, false);
  assert.equal(harness.liveUrls.size, 1);
  assert.equal(harness.timers.size, 0);
  assert.equal(history(harness).versions, versions);
  assert.equal(model(harness), previousModel);
  assert.equal(harness.props("PrintSettingsModal").isOpen, true);
  failed.onSubmit(submitEvent());
  assert.equal(harness.props("ChatPanel").draft, "");
  assert.equal(harness.liveUrls.size, 0);
  assert.equal(harness.props("PrintSettingsModal").isOpen, false);
  harness.advance(1800);
  assert.deepEqual(ids(history(harness).versions), ["v1", "v2", "v3", "v4"]);
});
