import * as aiApi from "../api/ai.api";
import type { AIMessage, AiUsage, RecommendationReason } from "../api/ai.api";
import type { MovieResult } from "../types/movie.types";

export interface ChatMessage {
  role: "user" | "ai";
  text: string;
  movies?: MovieResult[];
  reasoning?: RecommendationReason[];
  imageUrl?: string;
}

export interface AiChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  isHistoryLoading: boolean;
  cooldownUntil: number;
  usage: AiUsage | null;
}

/**
 * Strings the store needs for the messages it writes itself. The component owns
 * i18n, so it hands the resolved copy in with every action.
 */
export interface AiChatCopy {
  welcome: string;
  cleared: string;
  defaultFound: string;
  dailyLimit: string;
  error: string;
  photoSent: string;
  photoDailyLimit: string;
  photoError: string;
}

const CHAT_STORAGE_KEY = "movie_tracker_chat_history";
const CHAT_EXPIRATION_MS =
  Number(import.meta.env.VITE_CHAT_EXPIRATION_MS) || 7 * 24 * 60 * 60 * 1000;
const MAX_HISTORY = Number(import.meta.env.VITE_MAX_HISTORY) || 20;
const PERSIST_DEBOUNCE_MS = 1000;

export const COOLDOWN_SECONDS = 3;

const emptyState = (): AiChatState => ({
  messages: [],
  isLoading: false,
  isHistoryLoading: true,
  cooldownUntil: 0,
  usage: null,
});

let state: AiChatState = emptyState();

type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * Bumped whenever the store is reset (different user, or a test). Async work
 * captures it and drops its result if the session moved on meanwhile.
 */
let sessionToken = 0;
let sessionUserId: string | null = null;
let isInitialized = false;
/** True once the user has touched this session's conversation, which makes a
 * late-arriving history fetch stale — it must not clobber what is on screen. */
let conversationDirty = false;

function setState(patch: Partial<AiChatState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getState(): AiChatState {
  return state;
}

export function getCooldownSeconds(): number {
  return Math.max(0, Math.ceil((state.cooldownUntil - Date.now()) / 1000));
}

function currentUserId(): string {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return "anon";
    const parsed = JSON.parse(raw) as { id?: number };
    return parsed?.id != null ? String(parsed.id) : "anon";
  } catch {
    return "anon";
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function cancelPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
}

function writeLocalHistory(messages: ChatMessage[]) {
  localStorage.setItem(
    CHAT_STORAGE_KEY,
    JSON.stringify({ messages, timestamp: Date.now() }),
  );
}

function schedulePersist() {
  cancelPersist();
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const messages = state.messages;
    if (messages.length <= 1) return;
    const aiMsgs: AIMessage[] = messages.map((m) => ({
      role: m.role === "ai" ? "assistant" : "user",
      content: m.text,
      ...(m.movies && m.movies.length > 0 && { movies: m.movies }),
    }));
    aiApi
      .postHistory(aiMsgs)
      .catch(() => undefined)
      .finally(() => writeLocalHistory(messages));
  }, PERSIST_DEBOUNCE_MS);
}

function loadSavedMessages(welcome: string): ChatMessage[] {
  const saved = localStorage.getItem(CHAT_STORAGE_KEY);
  if (saved) {
    try {
      const { messages, timestamp } = JSON.parse(saved) as {
        messages: ChatMessage[];
        timestamp: number;
      };
      if (Date.now() - timestamp < CHAT_EXPIRATION_MS) return messages;
    } catch (e) {
      console.error("Error parsing chat history", e);
    }
  }
  return [{ role: "ai", text: welcome }];
}

async function loadHistory(copy: AiChatCopy) {
  const token = sessionToken;
  try {
    const history = await aiApi.getHistory();
    if (token !== sessionToken || conversationDirty) return;
    if (Array.isArray(history) && history.length > 0) {
      setState({
        messages: history.map((m) => ({
          role: m.role === "assistant" ? "ai" : "user",
          text: m.content,
          movies: m.movies,
        })),
      });
    } else {
      setState({ messages: loadSavedMessages(copy.welcome) });
    }
  } catch {
    if (token !== sessionToken || conversationDirty) return;
    setState({ messages: loadSavedMessages(copy.welcome) });
  } finally {
    if (token === sessionToken) setState({ isHistoryLoading: false });
  }
}

/**
 * Loads the conversation once per logged-in user. Mounting the chat page again
 * is a no-op, so an answer that arrived while the page was unmounted survives.
 */
export function initAiChat(copy: AiChatCopy): void {
  const userId = currentUserId();
  if (isInitialized && sessionUserId === userId) return;
  resetAiChatStore();
  isInitialized = true;
  sessionUserId = userId;
  // Seed the welcome line synchronously: the input is usable before the
  // history fetch settles, and the first request has to carry it.
  setState({ messages: [{ role: "ai", text: copy.welcome }] });
  void loadHistory(copy);
}

export function resetAiChatStore(): void {
  cancelPersist();
  sessionToken += 1;
  isInitialized = false;
  sessionUserId = null;
  conversationDirty = false;
  state = emptyState();
  for (const listener of listeners) listener();
}

function settleTurn(token: number) {
  if (token !== sessionToken) return;
  setState({
    isLoading: false,
    cooldownUntil: Date.now() + COOLDOWN_SECONDS * 1000,
  });
  schedulePersist();
  void refreshUsage();
}

export async function refreshUsage(): Promise<void> {
  const token = sessionToken;
  try {
    const usage = await aiApi.getUsage();
    if (token === sessionToken) setState({ usage });
  } catch {
    /* usage is decorative; a failure just leaves the last known value */
  }
}

export function clearChat(copy: AiChatCopy): void {
  cancelPersist();
  conversationDirty = true;
  setState({ messages: [{ role: "ai", text: copy.cleared }] });
  localStorage.removeItem(CHAT_STORAGE_KEY);
  aiApi.postHistory([]).catch(() => undefined);
}

export async function sendMessage(
  userText: string,
  copy: AiChatCopy,
): Promise<void> {
  if (state.isLoading || getCooldownSeconds() > 0) return;

  const token = sessionToken;
  const conversation: ChatMessage[] = [
    ...state.messages,
    { role: "user", text: userText },
  ];
  conversationDirty = true;
  setState({ messages: conversation, isLoading: true });
  schedulePersist();

  try {
    const trimmedMessages = conversation.slice(-MAX_HISTORY);

    const shownMovieIds = trimmedMessages
      .filter((m) => m.movies && m.movies.length > 0)
      .flatMap((m) => m.movies!.map((movie) => movie.id));

    const chatHistory: AIMessage[] = trimmedMessages.map((msg) => {
      let content = msg.text;
      if (msg.role === "ai" && msg.movies && msg.movies.length > 0) {
        const shownMovies = msg.movies.map((m) => m.title).join(", ");
        content += `\n[System note: I already showed these movies to the user: ${shownMovies}. Do not repeat them in next suggestions.]`;
      }
      return {
        role: msg.role === "ai" ? "assistant" : "user",
        content,
      };
    });

    const response = await aiApi.aiSearch({
      messages: chatHistory,
      shownMovieIds,
    });

    if (token !== sessionToken) return;
    setState({
      messages: [
        ...state.messages,
        {
          role: "ai",
          text: response.message || copy.defaultFound,
          movies: response.movies,
          reasoning: response.reasoning,
        },
      ],
    });
  } catch (error: unknown) {
    if (token !== sessionToken) return;
    const apiError = error as { response?: { status?: number } };
    setState({
      messages: [
        ...state.messages,
        {
          role: "ai",
          text:
            apiError.response?.status === 429 ? copy.dailyLimit : copy.error,
        },
      ],
    });
  } finally {
    settleTurn(token);
  }
}

/**
 * Identifies a movie/show from an uploaded screenshot. Separate from
 * sendMessage: it hits a different endpoint and daily limit, but shares the
 * same conversation, loading/cooldown gating, and persistence.
 */
export async function sendPhoto(
  file: File,
  previewUrl: string,
  copy: AiChatCopy,
  lang: string,
): Promise<void> {
  if (state.isLoading || getCooldownSeconds() > 0) return;

  const token = sessionToken;
  conversationDirty = true;
  setState({
    messages: [
      ...state.messages,
      { role: "user", text: copy.photoSent, imageUrl: previewUrl },
    ],
    isLoading: true,
  });
  schedulePersist();

  try {
    const response = await aiApi.identifyPhoto(file, lang);
    if (token !== sessionToken) return;
    setState({
      messages: [
        ...state.messages,
        {
          role: "ai",
          text: response.message || copy.defaultFound,
          movies: response.movies,
        },
      ],
    });
  } catch (error: unknown) {
    if (token !== sessionToken) return;
    const apiError = error as { response?: { status?: number } };
    setState({
      messages: [
        ...state.messages,
        {
          role: "ai",
          text:
            apiError.response?.status === 429
              ? copy.photoDailyLimit
              : copy.photoError,
        },
      ],
    });
  } finally {
    settleTurn(token);
  }
}
