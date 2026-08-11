import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Login from "./Login";
import { AuthProvider } from "../context/AuthContext";
import { LanguageProvider } from "../context/LanguageContext";
import * as authApi from "../api/auth.api";

vi.mock("../api/auth.api");

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockedLogin = vi.mocked(authApi.login);

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LanguageProvider>
          <Login />
        </LanguageProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("Login", () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockClear();
    mockedLogin.mockReset();
  });

  it("renders the login form", () => {
    renderLogin();

    expect(screen.getByText("LUMEN")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("name@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it("does not submit when email and password are empty", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(mockedLogin).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("calls the login API with entered credentials and navigates on success", async () => {
    mockedLogin.mockResolvedValue({
      access_token: "token-123",
      user: { id: 1, username: "alice", email: "alice@test.com" },
    });
    const user = userEvent.setup();
    renderLogin();

    await user.type(
      screen.getByPlaceholderText("name@example.com"),
      "alice@test.com",
    );
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(mockedLogin).toHaveBeenCalledWith({
        email: "alice@test.com",
        password: "password123",
      }),
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/watchlist"));
  });

  it("shows the server-provided error message when login fails", async () => {
    mockedLogin.mockRejectedValue({
      response: { data: { message: "Wrong credentials" } },
    });
    const user = userEvent.setup();
    renderLogin();

    await user.type(
      screen.getByPlaceholderText("name@example.com"),
      "alice@test.com",
    );
    await user.type(screen.getByPlaceholderText("••••••••"), "wrongpass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Wrong credentials")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows a generic error message when the API call fails without a message", async () => {
    mockedLogin.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    renderLogin();

    await user.type(
      screen.getByPlaceholderText("name@example.com"),
      "alice@test.com",
    );
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText("Invalid email or password. Please try again!"),
    ).toBeInTheDocument();
  });

  it("offers to resend the verification email when that is the failure reason", async () => {
    mockedLogin.mockRejectedValue({
      response: { data: { message: "Please verify your email first" } },
    });
    const user = userEvent.setup();
    renderLogin();

    await user.type(
      screen.getByPlaceholderText("name@example.com"),
      "alice@test.com",
    );
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText("Please verify your email first"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /resend verification email/i }),
    ).toBeInTheDocument();
  });
});
