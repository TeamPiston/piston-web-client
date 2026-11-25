import assert from "node:assert/strict";
import { createAuthLocks } from "./test-auth-locks.mjs";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, Script } from "node:vm";
import test from "node:test";
import ts from "typescript";
const file = fileURLToPath(import.meta.url);
const root = resolve(dirname(file), "..");
const tick = () => new Promise((resolveTick) => setImmediate(resolveTick));
const nodes = (value) => Array.isArray(value) ? value.flatMap(nodes) :
    value && typeof value === "object" ? [value, ...nodes(value.props?.children)] : [];
if (!process.argv.includes("--child")) {
    for (const mode of ["true", "false", undefined, "", "TRUE"]) {
        const env = { ...process.env, NODE_ENV: "production", NEXT_PUBLIC_USE_MOCK: mode };
        if (mode === undefined)
            delete env.NEXT_PUBLIC_USE_MOCK;
        console.log("ACCOUNT DELETION MODE " + JSON.stringify(mode ?? "unset"));
        execFileSync(process.execPath, [file, "--child"], { env, stdio: "inherit" });
    }
}
else {
    // Real account action, MyPage deletion callback, modal and Session Provider.
    // Hook cells/context and skipped effects do not simulate React DOM/scheduling.
    function harness(deleteReply) {
        const modules = new Map(), slots = new Map(), writes = [], routes = [], requests = [], logs = [];
        const existingUser = { id: "existing-user", email: "existing@example.com", name: "Fixture" };
        const storage = new Map([["piston-auth", JSON.stringify(existingUser)], ["piston-access-token", "synthetic-token"]]);
        if (process.env.NEXT_PUBLIC_USE_MOCK !== "true") {
            storage.clear();
            storage.set("piston-api-session", JSON.stringify({
                id: "deletion-session", accessToken: "fixture-access", refreshToken: "fixture-refresh",
            }));
        }
        const events = new EventTarget();
        let owner, cursor;
        const react = {
            useState(initial) {
                const cells = slots.get(owner), index = cursor++;
                if (!(index in cells))
                    cells[index] = typeof initial === "function" ? initial() : initial;
                return [cells[index], (value) => { cells[index] = typeof value === "function" ? value(cells[index]) : value; }];
            },
            useRef(initial) {
                const cells = slots.get(owner), index = cursor++;
                if (!(index in cells)) cells[index] = { current: initial };
                return cells[index];
            },
            useEffect(setup, dependencies) {
                const cells = slots.get(owner), index = cursor++;
                const previous = cells[index];
                if (owner !== "provider" || previous?.dependencies.every((value, i) => value === dependencies[i])) return;
                previous?.cleanup?.();
                cells[index] = { dependencies, cleanup: setup() };
            },
            useCallback: (callback) => callback,
            createContext: (value) => ({ value, Provider: "SessionProvider" }),
            useContext: (context) => context.value,
        };
        const window = {
            navigator: { locks: createAuthLocks() },
            localStorage: {
                getItem: (key) => storage.get(key) ?? null,
                setItem: (key, value) => { writes.push(key); storage.set(key, value); },
                removeItem: (key) => { writes.push(key); storage.delete(key); },
            },
            addEventListener: events.addEventListener.bind(events),
            removeEventListener: events.removeEventListener.bind(events),
            dispatchEvent: events.dispatchEvent.bind(events),
            location: { search: "", pathname: "/mypage", origin: "https://frontend.invalid", assign: (url) => routes.push(url) },
        };
        const context = createContext({
            AbortSignal, Event,
            process: { env: { NODE_ENV: "production", NEXT_PUBLIC_USE_MOCK: process.env.NEXT_PUBLIC_USE_MOCK, NEXT_PUBLIC_API_BASE_URL: "https://deletion.invalid" } },
            window, Headers, URL, URLSearchParams, FormData, Blob, ArrayBuffer,
            console: Object.fromEntries(["log", "error", "warn", "debug", "info"].map((key) => [key, (...args) => logs.push(args)])),
            fetch: async (url, init) => {
                assert.equal(url, "https://deletion.invalid/api/users/me");
                requests.push({ url, ...init });
                if (init.method === "GET") {
                    const second = init.headers.get("Authorization") === "Bearer second-fixture-access";
                    return Response.json({
                        userId: second ? 6 : 5, loginId: second ? "second" : "admin",
                        email: second ? "second@example.invalid" : "real-admin@example.invalid",
                        createdAt: "2026-01-01T00:00:00Z",
                    });
                }
                assert.equal(init.method, "DELETE");
                assert(deleteReply, "Unexpected DELETE");
                return deleteReply();
            },
        });
        function load(path) {
            if (modules.has(path))
                return modules.get(path).exports;
            const loaded = { exports: {} };
            modules.set(path, loaded);
            const require = (name) => {
                if (name === "react")
                    return react;
                if (name === "react/jsx-runtime")
                    return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
                if (name === "next/navigation")
                    return { useRouter: () => ({ replace: (url) => routes.push(url), push: (url) => routes.push(url) }) };
                if (name === "next/link")
                    return { default: "Link" };
                if (name === "lucide-react")
                    return { CircleUserRound: "CircleUserRound" };
                if (name === "@/entities/print")
                    return { PRINT_ARTWORK_NAME: "Fixture" };
                if (name === "@/features/stl-viewer")
                    return { ArtworkModelPreview: "ArtworkModelPreview" };
                if (name === "@/widgets/header")
                    return { Header: "Header" };
                if (name.startsWith("./") && /(?:design-detail|print-retry-confirm|printer-management-page|print-status-detail)-?/.test(name)) {
                    return { DesignDetailModal: "DesignDetailModal", PrintRetryConfirmModal: "PrintRetryConfirmModal",
                        PrinterManagementPage: "PrinterManagementPage", PrintStatusDetailModal: "PrintStatusDetailModal" };
                }
                const target = name.startsWith("@/") ? resolve(root, "src", name.slice(2)) : resolve(dirname(path), name);
                const found = [target + ".ts", target + ".tsx", resolve(target, "index.ts")].find(existsSync);
                assert(found, "Unexpected import " + name);
                return load(found);
            };
            let input = readFileSync(path, "utf8");
            // Expose the real private page component only in the test compilation.
            if (path.endsWith("mypage-page.tsx"))
                input += "\nexport { MyProfilePage };";
            const output = ts.transpileModule(input, {
                compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: path,
            }).outputText;
            new Script("(function(require,module,exports){" + output + "\n})", { filename: path }).runInContext(context)(require, loaded, loaded.exports);
            return loaded.exports;
        }
        const session = load(resolve(root, "src/entities/session/index.ts"));
        const sessionContext = load(resolve(root, "src/entities/session/model/context.ts")).SessionContext;
        const mock = load(resolve(root, "src/shared/mock/mock-data.ts"));
        const { MyProfilePage } = load(resolve(root, "src/page-slices/mypage/ui/mypage-page.tsx"));
        const { DeleteAccountModal } = load(resolve(root, "src/page-slices/mypage/ui/delete-account-modal.tsx"));
        function render(key, fn) {
            owner = key;
            cursor = 0;
            if (!slots.has(key))
                slots.set(key, []);
            return fn();
        }
        function provider() {
            const tree = render("provider", () => session.AuthProvider({ children: null }));
            sessionContext.value = tree.props.value;
            return tree.props.value;
        }
        function page() { provider(); return render("page", MyProfilePage); }
        function modalProps() { return nodes(page()).find((node) => node.type === DeleteAccountModal).props; }
        function modal() { const props = modalProps(); return render("modal", () => DeleteAccountModal(props)); }
        function open() {
            nodes(page()).find((node) => node.type === "button" && node.props.children === "회원탈퇴").props.onClick();
            return modal();
        }
        function confirm() {
            const button = nodes(modal()).find((node) => node.type === "button" && node.props.children === "탈퇴하기");
            assert(button && !button.props.disabled);
            button.props.onClick();
            button.props.onClick();
            assert(nodes(modal()).filter((node) => node.type === "button").every((button) => button.props.disabled));
        }
        provider();
        return { session, mock, window, storage, writes, routes, requests, logs, provider, modalProps, modal, open, confirm, page };
    }
    async function apiReady(h) {
        assert.equal(h.provider().isRestoring, true);
        await tick();
        assert.equal(h.provider().isLoggedIn, true);
        assert.equal(h.requests.length, 1);
        assert.equal(h.requests.shift().method, "GET");
    }
    function assertRetained(h, saved) {
        assert.equal(JSON.stringify([...h.storage]), saved);
        assert.equal(h.provider().isLoggedIn, process.env.NEXT_PUBLIC_USE_MOCK === "true");
        assert.deepEqual(h.writes, []);
        assert.deepEqual(h.routes, []);
        assert.equal(h.requests.length, 0);
        assert.deepEqual(h.logs, []);
    }
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
        test("Mock action sets only its existing deletion flag, without HTTP", async () => {
            const h = harness();
            await h.session.deleteCurrentAccount();
            assert.equal((await h.mock.fetchMockAccountSettings()).isDeleted, true);
            assert(h.provider().isLoggedIn);
            assert.equal(h.requests.length, 0);
        });
        test("Mock confirmation clears the real session/token and navigates only after success", async () => {
            const h = harness();
            h.open();
            h.confirm();
            await tick();
            assert.equal((await h.mock.fetchMockAccountSettings()).isDeleted, true);
            assert.equal(h.provider().isLoggedIn, false);
            assert.equal(h.storage.size, 0);
            assert.equal(h.modalProps().isOpen, false);
            assert.deepEqual(h.routes, ["/login"]);
            assert.equal(h.requests.length, 0);
            assert.deepEqual(h.logs, []);
        });
        test("Mock failure retains session, restores buttons and supports retry", async () => {
            const h = harness(), saved = JSON.stringify([...h.storage]);
            h.window.location.search = "?mockError=account-delete";
            h.open();
            h.confirm();
            await tick();
            assertRetained(h, saved);
            assert.equal((await h.mock.fetchMockAccountSettings()).isDeleted, false);
            const alert = nodes(h.modal()).find((node) => node.props?.role === "alert");
            assert(alert);
            assert.match(alert.props.children, /결과를 확인할 수 없습니다/);
            assert(nodes(h.modal()).filter((node) => node.type === "button").every((button) => !button.props.disabled));
            h.window.location.search = "";
            h.confirm();
            await tick();
            assert.equal(h.provider().isLoggedIn, false);
            assert.deepEqual(h.routes, ["/login"]);
        });
    }
    else {
        const storageKey = "piston-api-session";
        const secondSession = { id: "other-session", accessToken: "second-fixture-access", refreshToken: "second-fixture-refresh" };
        const confirmationButton = (h) => nodes(h.modal()).find((node) =>
            node.type === "button" && node.props.children === "탈퇴하기");
        const assertSessionChanged = (h) => {
            const alert = nodes(h.modal()).find((node) => node.props?.role === "alert");
            assert.match(alert?.props.children ?? "", /로그인 계정이 변경되었습니다/);
        };

        test("cross-tab storage change invalidates the open confirmation and verifies the other profile", async () => {
            const h = harness();
            await apiReady(h);
            h.open();
            const staleConfirm = confirmationButton(h).props.onClick;
            h.storage.set(storageKey, JSON.stringify(secondSession));
            const event = new Event("storage");
            Object.defineProperty(event, "key", { value: storageKey });
            h.window.dispatchEvent(event);
            assert.equal(h.provider().isRestoring, true);
            assert.equal(confirmationButton(h).props.disabled, true);
            assertSessionChanged(h);
            staleConfirm();
            await tick();
            assert.equal(h.provider().user.userId, "6");
            assert.equal(confirmationButton(h).props.disabled, true);
            assert.deepEqual(h.requests.map(({ method }) => method), ["GET"]);
            assert.deepEqual(JSON.parse(h.storage.get(storageKey)), secondSession);
        });

        test("account change before the storage event and unreadable storage both block the confirmation", async () => {
            for (const change of [(h) => h.storage.set(storageKey, JSON.stringify(secondSession)),
                (h) => { h.window.localStorage.getItem = () => { throw new Error("storage unavailable"); }; }]) {
                const h = harness();
                await apiReady(h);
                h.open();
                change(h);
                h.confirm();
                await tick();
                assertSessionChanged(h);
                assert.equal(h.requests.length, 0);
                assert.deepEqual(h.routes, []);
            }
        });

        test("a session switch between validation reads blocks the DELETE", async () => {
            const h = harness();
            await apiReady(h);
            h.open();
            const getItem = h.window.localStorage.getItem;
            h.window.localStorage.getItem = (key) => {
                const raw = getItem(key);
                if (key === storageKey) h.storage.set(key, JSON.stringify(secondSession));
                return raw;
            };
            h.confirm();
            await tick();
            assert.equal(h.requests.length, 0);
            assertSessionChanged(h);
        });

        test("a storage switch at the last check never substitutes the other account's bearer", async () => {
            const h = harness(() => new Response(null, { status: 204 }));
            await apiReady(h);
            h.open();
            const getItem = h.window.localStorage.getItem;
            let reads = 0;
            h.window.localStorage.getItem = (key) => {
                const raw = getItem(key);
                if (key === storageKey && ++reads === 2) h.storage.set(key, JSON.stringify(secondSession));
                return raw;
            };
            h.confirm();
            await tick();
            assert.deepEqual(h.requests.map((request) => [request.method, request.headers.get("Authorization")]),
                [["DELETE", "Bearer fixture-access"]]);
            assert.deepEqual(JSON.parse(h.storage.get(storageKey)), secondSession);
            assert.deepEqual(h.routes, []);
        });

        test("API confirmation issues one authenticated DELETE, then clears the session without server logout", async () => {
            let finish;
            const h = harness(() => new Promise((resolve) => { finish = resolve; }));
            await apiReady(h);
            assert(nodes(h.page()).some((node) => node.type === "h1" && node.props.children === "admin"));
            assert(nodes(h.page()).some((node) => node.type === "p" && node.props.children === "real-admin@example.invalid"));
            h.open();
            const saved = JSON.stringify([...h.storage]);
            h.confirm();
            assert.equal(h.requests.length, 1);
            assert.equal(JSON.stringify([...h.storage]), saved);
            assert.equal(h.requests[0].headers.get("Authorization"), "Bearer fixture-access");
            assert.equal(h.requests[0].method, "DELETE");
            assert.equal(h.requests[0].redirect, "error");
            finish(new Response(null, { status: 204 }));
            await tick();
            assert.equal(h.requests.length, 1);
            assert.equal(h.provider().isLoggedIn, false);
            assert.equal(h.storage.size, 0);
            assert.equal(h.modalProps().isOpen, false);
            assert.deepEqual(h.routes, ["/login"]);
            assert.deepEqual(h.logs, []);
        });
        test("API failure or ambiguous network response keeps the session and never retries DELETE", async () => {
            for (const respond of [
                () => Response.json({}, { status: 500 }),
                () => { throw new TypeError("simulated connection failure"); },
                () => Response.json({}, { status: 200 }),
            ]) {
                const h = harness(respond);
                await apiReady(h);
                const saved = JSON.stringify([...h.storage]);
                h.open();
                h.confirm();
                await tick();
                assert.equal(h.requests.length, 1);
                assert.equal(JSON.stringify([...h.storage]), saved);
                assert.equal(h.provider().isLoggedIn, true);
                assert.deepEqual(h.writes, []);
                assert.deepEqual(h.routes, []);
                const alert = nodes(h.modal()).find((node) => node.props?.role === "alert");
                assert.match(alert.props.children, /결과를 확인할 수 없습니다/);
                assert(nodes(h.modal()).filter((node) => node.type === "button").every((button) => !button.props.disabled));
                assert.equal((await h.mock.fetchMockAccountSettings()).isDeleted, false);
                assert.deepEqual(h.logs, []);
            }
        });
    }
}
