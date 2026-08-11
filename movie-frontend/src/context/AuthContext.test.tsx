import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";

vi.mock("../api/index", () => ({
  api: {
    defaults: { headers: { common: {} as Record<string, string> } },
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("useAuth", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("throws when used outside an AuthProvider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used within an AuthProvider",
    );
  });

  it("starts unauthenticated when localStorage has no stored session", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it("restores a session from localStorage on mount", async () => {
    localStorage.setItem("token", "stored-token");
    localStorage.setItem(
      "user",
      JSON.stringify({ id: 1, username: "alice", email: "alice@test.com" }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.username).toBe("alice");
    expect(result.current.token).toBe("stored-token");
  });

  it("clears a corrupted stored user and starts unauthenticated", async () => {
    localStorage.setItem("token", "stored-token");
    localStorage.setItem("user", "not-valid-json");

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("login stores the session and marks the user authenticated", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.login("new-token", {
        id: 2,
        username: "bob",
        email: "bob@test.com",
      });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.username).toBe("bob");
    expect(localStorage.getItem("token")).toBe("new-token");
    expect(JSON.parse(localStorage.getItem("user")!).username).toBe("bob");
  });

  it("logout clears the session", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.login("new-token", {
        id: 2,
        username: "bob",
        email: "bob@test.com",
      });
    });
    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
  });
});
