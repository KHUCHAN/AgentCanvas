import type {
  ExtensionToWebviewMessage,
  RequestId,
  WebviewToExtensionMessage
} from "./protocol";
import { isResponseMessage } from "./protocol";

declare global {
  interface Window {
    acquireVsCodeApi?: () => {
      postMessage: (message: WebviewToExtensionMessage) => void;
    };
  }
}

const vscodeApi = window.acquireVsCodeApi?.();
const listeners = new Set<(message: ExtensionToWebviewMessage) => void>();
const pending = new Map<
  RequestId,
  {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeoutId: number;
  }
>();

let initialized = false;
let bridgeMessageHandler:
  | ((event: MessageEvent<ExtensionToWebviewMessage>) => void)
  | undefined;

function ensureBridgeInitialized(): void {
  if (initialized) {
    return;
  }
  initialized = true;
  bridgeMessageHandler = (event: MessageEvent<ExtensionToWebviewMessage>) => {
    const message = event.data;
    if (!isValidExtensionMessage(message)) {
      console.warn("Ignoring invalid extension message", message);
      return;
    }

    if (isResponseMessage(message)) {
      const target = pending.get(message.inReplyTo);
      if (!target) {
        return;
      }
      window.clearTimeout(target.timeoutId);
      pending.delete(message.inReplyTo);

      if (message.type === "RESPONSE_OK") {
        target.resolve(message.result);
      } else {
        target.reject(
          new Error(
            message.error.detail
              ? `${message.error.message}: ${message.error.detail}`
              : message.error.message
          )
        );
      }
      return;
    }

    listeners.forEach((listener) => listener(message));
  };
  window.addEventListener("message", bridgeMessageHandler);
}

export function postToExtension(message: WebviewToExtensionMessage): void {
  ensureBridgeInitialized();

  if (!vscodeApi) {
    console.warn("VS Code API unavailable", message);
    return;
  }
  vscodeApi.postMessage(message);
}

export async function requestToExtension<T = unknown>(
  message: WebviewToExtensionMessage,
  timeoutMs = 15000
): Promise<T> {
  ensureBridgeInitialized();

  if (!vscodeApi) {
    throw new Error("VS Code API unavailable");
  }

  const requestId = makeRequestId();
  const withRequestId = {
    ...message,
    requestId
  } as WebviewToExtensionMessage;

  return await new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      pending.delete(requestId);
      reject(new Error(`Request timed out: ${message.type}`));
    }, timeoutMs);

    pending.set(requestId, {
      resolve: (value) => resolve(value as T),
      reject,
      timeoutId
    });

    vscodeApi.postMessage(withRequestId);
  });
}

export function onExtensionMessage(
  handler: (message: ExtensionToWebviewMessage) => void
): () => void {
  ensureBridgeInitialized();
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}

export function cleanupBridge(): void {
  if (bridgeMessageHandler) {
    window.removeEventListener("message", bridgeMessageHandler);
    bridgeMessageHandler = undefined;
  }

  for (const [requestId, target] of pending.entries()) {
    window.clearTimeout(target.timeoutId);
    target.reject(new Error(`Bridge disposed before response: ${requestId}`));
  }
  pending.clear();
  listeners.clear();
  initialized = false;
}

function makeRequestId(): RequestId {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isValidExtensionMessage(value: unknown): value is ExtensionToWebviewMessage {
  if (!value || typeof value !== "object") {
    return false;
  }
  const message = value as Record<string, unknown>;
  if (typeof message.type !== "string") {
    return false;
  }

  switch (message.type) {
    case "INIT_STATE":
      return hasObjectPayload(message, "payload") && isObject(message.payload.snapshot);
    case "STATE_PATCH":
      return hasObjectPayload(message, "payload");
    case "IMPORT_PREVIEW":
      return hasObjectPayload(message, "payload") && isObject(message.payload.preview);
    case "CLI_BACKENDS":
      return hasObjectPayload(message, "payload") && Array.isArray(message.payload.backends);
    case "PROMPT_HISTORY":
      return hasObjectPayload(message, "payload") && Array.isArray(message.payload.items);
    case "SCHEDULE_EVENT":
      return hasObjectPayload(message, "payload") && isObject(message.payload.event);
    case "GENERATION_PROGRESS":
      return (
        hasObjectPayload(message, "payload") &&
        typeof message.payload.stage === "string" &&
        typeof message.payload.message === "string"
      );
    case "TOAST":
      return (
        hasObjectPayload(message, "payload") &&
        typeof message.payload.level === "string" &&
        typeof message.payload.message === "string"
      );
    case "ERROR":
      return hasObjectPayload(message, "payload") && typeof message.payload.message === "string";
    case "RESPONSE_OK":
      return typeof message.inReplyTo === "string";
    case "RESPONSE_ERROR":
      return (
        typeof message.inReplyTo === "string" &&
        isObject(message.error) &&
        typeof message.error.message === "string"
      );
    default:
      return false;
  }
}

function hasObjectPayload<T extends string>(
  message: Record<string, unknown>,
  key: T
): message is Record<string, unknown> & { [K in T]: Record<string, unknown> } {
  return isObject(message[key]);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
