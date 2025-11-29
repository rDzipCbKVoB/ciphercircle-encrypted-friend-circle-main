const STORAGE_KEY = "ciphercircle_local_posts";

export interface LocalPostDraft {
  text: string;
  ipfsHash?: string;
  isEncrypted: boolean;
  createdAt: number;
}

type DraftStore = Record<string, LocalPostDraft>;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStore(): DraftStore {
  if (!isBrowser()) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as DraftStore;
  } catch (error) {
    console.error("Failed to read local draft store", error);
    return {};
  }
}

function writeStore(store: DraftStore) {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.error("Failed to persist local draft store", error);
  }
}

export function saveLocalPostDraft(postId: string, draft: LocalPostDraft) {
  if (!postId) return;
  const store = readStore();
  store[postId] = draft;
  writeStore(store);
}

export function getLocalPostDraft(postId: string): (LocalPostDraft & { id: string }) | null {
  if (!postId) return null;
  const store = readStore();
  const draft = store[postId];
  if (!draft) return null;
  return {
    id: postId,
    ...draft,
  };
}

export function removeLocalPostDraft(postId: string) {
  if (!postId) return;
  const store = readStore();
  if (store[postId]) {
    delete store[postId];
    writeStore(store);
  }
}


