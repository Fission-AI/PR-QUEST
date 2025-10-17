/*
  Lightweight debug logger for both server and client.
  Enable globally via:
  - Server: PR_QUEST_DEBUG=true
  - Client: NEXT_PUBLIC_PR_QUEST_DEBUG=true

  Optional namespace filter (comma-separated, supports "*"):
  - Server: PR_QUEST_DEBUG_NS="validate-pr,api-diff,api-group,ui,intake,step-viewer"
  - Client: NEXT_PUBLIC_PR_QUEST_DEBUG_NS="ui,intake,step-viewer"
*/

type AnyRecord = Record<string, unknown>;

function getEnv(name: string): string | undefined {
  try {
    return typeof process !== "undefined" && process?.env ? process.env[name] : undefined;
  } catch {
    return undefined;
  }
}

function getPublicEnv(name: string): string | undefined {
  try {
    // On client, NEXT_PUBLIC_* are inlined by Next.js
    return typeof process !== "undefined" && process?.env ? process.env[name] : undefined;
  } catch {
    return undefined;
  }
}

function readFlag(): boolean {
  const serverFlag = getEnv("PR_QUEST_DEBUG");
  const clientFlag = getPublicEnv("NEXT_PUBLIC_PR_QUEST_DEBUG");
  const value = (serverFlag ?? clientFlag ?? "").toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function readNamespaces(): string[] {
  const ns =
    getEnv("PR_QUEST_DEBUG_NS") ?? getPublicEnv("NEXT_PUBLIC_PR_QUEST_DEBUG_NS") ?? "";
  return ns
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isDebugEnabled(namespace?: string): boolean {
  if (!readFlag()) return false;
  const namespaces = readNamespaces();
  if (namespaces.length === 0) return true; // all namespaces
  if (namespaces.includes("*")) return true;
  if (!namespace) return true;
  return namespaces.includes(namespace);
}

export function debugLog(namespace: string, message: string, details?: AnyRecord) {
  if (!isDebugEnabled(namespace)) return;
  const prefix = `[PRQ][${namespace}]`;
  if (details && Object.keys(details).length > 0) {
    // eslint-disable-next-line no-console
    console.log(prefix, message, details);
  } else {
    // eslint-disable-next-line no-console
    console.log(prefix, message);
  }
}

export function startDebugTimer(namespace: string, label: string) {
  const start = Date.now();
  debugLog(namespace, `${label} — start`);
  return {
    end(extra?: AnyRecord) {
      const ms = Date.now() - start;
      debugLog(namespace, `${label} — end`, { ms, ...(extra ?? {}) });
    },
  };
}


