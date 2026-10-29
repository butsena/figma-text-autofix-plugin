import vm from "node:vm";
import { webcrypto, createHash } from "node:crypto";

// Execute the actual Figma entry point; fetch is intercepted, never forwarded.
export async function verifyAnalyticsBundle(bytes, expected) {
  const posts = [];
  const figma = {
    currentPage: { selection: [{ type: "TEXT", id: "PRIVATE_NODE", name: "PRIVATE_NAME", characters: "Кватира", visible: true, parent: null }] },
    notify() {}, closePlugin() {}, showUI() {}, getNodeByIdAsync: async () => null,
    ui: { postMessage() {}, resize() {}, onmessage: null },
  };
  const scope = vm.createContext({ figma, crypto: webcrypto, console: { log() {}, warn() {}, error() {} },
    setTimeout() { return 0; }, clearTimeout() {},
    fetch: async (url, init) => { posts.push({ url, envelope: JSON.parse(init.body) }); return { ok: true, status: 200 }; },
  });
  vm.runInContext(bytes.toString(), scope, { timeout: 5000 });
  if (typeof figma.ui.onmessage !== "function") throw new Error("Figma entry did not initialize");
  await figma.ui.onmessage({ type: "ui:applyManualFix", nodeId: "PRIVATE_NODE", spellingSource: "suggested",
    fix: { fixId: "PRIVATE_FIX", from: 0, to: 7, before: "Кватира", after: "Квартира",
      rule: { id: "orthography-spellcheck", category: "orthography", message: "PRIVATE_MESSAGE", priority: 1, applyPolicy: "confirm" } } });
  if (posts.length !== (expected.enabled ? 2 : 0)) throw new Error("Unexpected analytics event count in built file");
  for (const p of posts) {
    if (p.url !== expected.endpoint || p.envelope.plugin_version !== expected.pluginVersion || p.envelope.traffic_mode !== expected.trafficMode) throw new Error("Built analytics config differs from expected config");
  }
  if (expected.enabled && (posts[0].envelope.event !== "plugin_open" || posts[1].envelope.event !== "plugin_error" ||
      posts[1].envelope.payload.code !== "node_missing" || posts[1].envelope.payload.outcome !== "failed")) throw new Error("Built error path changed");
  if (/PRIVATE_|Кватира|Квартира/.test(JSON.stringify(posts))) throw new Error("Private fixture escaped into analytics");
  return { sha256: createHash("sha256").update(bytes).digest("hex"), networkIntercepted: true, eventCount: posts.length };
}
