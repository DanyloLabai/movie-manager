import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AiChat from "./AiChat";
import { LanguageProvider } from "../context/LanguageContext";
import * as aiApi from "../api/ai.api";
import * as moviesApi from "../api/movies.api";
import * as usersApi from "../api/users.api";

vi.mock("../api/ai.api");
vi.mock("../api/movies.api");
vi.mock("../api/users.api");

const mockedGetHistory = vi.mocked(aiApi.getHistory);
const mockedPostHistory = vi.mocked(aiApi.postHistory);
const mockedAiSearch = vi.mocked(aiApi.aiSearch);
const mockedGetUsage = vi.mocked(aiApi.getUsage);
const mockedGetProfile = vi.mocked(moviesApi.getProfile);
const mockedGetNotifications = vi.mocked(moviesApi.getNotifications);
const mockedGetFriendRequests = vi.mocked(usersApi.getFriendRequests);

// jsdom does not implement Element.scrollTo; AiChat calls it to keep the
// message list pinned to the bottom on every render.
Element.prototype.scrollTo = vi.fn();

function renderAiChat() {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <AiChat />
      </LanguageProvider>
    </MemoryRouter>,
  );
}

describe("AiChat", () => {
  beforeEach(() => {
    localStorage.clear();
    mockedGetHistory.mockReset().mockResolvedValue([]);
    mockedPostHistory.mockReset().mockResolvedValue({ success: true });
    mockedAiSearch.mockReset();
    mockedGetUsage.mockReset().mockResolvedValue({
      requestCount: 1,
      totalTokens: 100,
      requestLimit: 20,
      tokenLimit: 10000,
    });
    mockedGetProfile.mockReset().mockResolvedValue({ favorites: [], recent: [] });
    mockedGetNotifications.mockReset().mockResolvedValue([]);
    mockedGetFriendRequests.mockReset().mockResolvedValue([]);
  });

  it("renders the message input once history has loaded", async () => {
    renderAiChat();

    expect(
      await screen.findByPlaceholderText("Ask about a movie..."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Hi! I'm your movie expert. Ask me about any movie, or describe a plot you can't remember.",
      ),
    ).toBeInTheDocument();
  });

  it("sends a typed message to the AI with the correct payload", async () => {
    mockedAiSearch.mockResolvedValue({ message: "Here are some picks" });
    const user = userEvent.setup();
    renderAiChat();

    const input = await screen.findByPlaceholderText("Ask about a movie...");
    await user.type(input, "Recommend a horror movie{Enter}");

    await waitFor(() =>
      expect(mockedAiSearch).toHaveBeenCalledWith({
        messages: [
          {
            role: "assistant",
            content:
              "Hi! I'm your movie expert. Ask me about any movie, or describe a plot you can't remember.",
          },
          { role: "user", content: "Recommend a horror movie" },
        ],
        shownMovieIds: [],
      }),
    );
  });

  it("displays the AI's response once it arrives", async () => {
    mockedAiSearch.mockResolvedValue({ message: "Here are some picks" });
    const user = userEvent.setup();
    renderAiChat();

    const input = await screen.findByPlaceholderText("Ask about a movie...");
    await user.type(input, "Recommend a horror movie{Enter}");

    expect(await screen.findByText("Here are some picks")).toBeInTheDocument();
  });

  it("shows the daily-limit error when the API responds with 429", async () => {
    mockedAiSearch.mockRejectedValue({ response: { status: 429 } });
    const user = userEvent.setup();
    renderAiChat();

    const input = await screen.findByPlaceholderText("Ask about a movie...");
    await user.type(input, "Recommend a horror movie{Enter}");

    expect(
      await screen.findByText(
        "You've reached today's AI request limit. Please come back tomorrow.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a generic error message when the API call fails", async () => {
    mockedAiSearch.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    renderAiChat();

    const input = await screen.findByPlaceholderText("Ask about a movie...");
    await user.type(input, "Recommend a horror movie{Enter}");

    expect(
      await screen.findByText(
        "Oops, something went wrong. Please try again later.",
      ),
    ).toBeInTheDocument();
  });
});
