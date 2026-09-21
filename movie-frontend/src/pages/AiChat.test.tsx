import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AiChat from "./AiChat";
import { LanguageProvider } from "../context/LanguageContext";
import * as aiApi from "../api/ai.api";
import * as moviesApi from "../api/movies.api";
import * as usersApi from "../api/users.api";
import { resetAiChatStore } from "../store/aiChatStore";
import type { MovieResult } from "../types/movie.types";

vi.mock("../api/ai.api");
vi.mock("../api/movies.api");
vi.mock("../api/users.api");

const mockedGetHistory = vi.mocked(aiApi.getHistory);
const mockedPostHistory = vi.mocked(aiApi.postHistory);
const mockedAiSearch = vi.mocked(aiApi.aiSearch);
const mockedIdentifyPhoto = vi.mocked(aiApi.identifyPhoto);
const mockedGetUsage = vi.mocked(aiApi.getUsage);
const mockedGetProfile = vi.mocked(moviesApi.getProfile);
const mockedGetNotifications = vi.mocked(moviesApi.getNotifications);
const mockedGetFriendRequests = vi.mocked(usersApi.getFriendRequests);

// jsdom does not implement Element.scrollTo; AiChat calls it to keep the
// message list pinned to the bottom on every render.
Element.prototype.scrollTo = vi.fn();
// jsdom does not implement URL.createObjectURL either; the photo-identify
// flow uses it to preview the uploaded image in the user's chat bubble.
URL.createObjectURL = vi.fn(() => "blob:mock-preview-url");

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
    // The chat store outlives the component so answers survive navigation;
    // tests have to clear it themselves.
    resetAiChatStore();
    mockedGetHistory.mockReset().mockResolvedValue([]);
    mockedPostHistory.mockReset().mockResolvedValue({ success: true });
    mockedAiSearch.mockReset();
    mockedIdentifyPhoto.mockReset();
    mockedGetUsage.mockReset().mockResolvedValue({
      requestCount: 1,
      totalTokens: 100,
      requestLimit: 20,
      tokenLimit: 10000,
      photoRequestCount: 0,
      photoRequestLimit: 3,
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

  it("finishes a pending request after the page unmounts and shows the answer on return", async () => {
    let resolveSearch!: (value: { message?: string }) => void;
    mockedAiSearch.mockImplementation(
      () => new Promise((resolve) => (resolveSearch = resolve)),
    );
    const user = userEvent.setup();
    const { unmount } = renderAiChat();

    await screen.findByPlaceholderText("Ask about a movie...");
    await user.click(
      screen.getByRole("button", {
        name: "Suggest a mind-bending sci-fi movie",
      }),
    );
    await waitFor(() => expect(mockedAiSearch).toHaveBeenCalledTimes(1));

    // Navigating away tears the page down while the AI is still thinking.
    unmount();
    resolveSearch({ message: "Here are some picks" });

    renderAiChat();
    expect(await screen.findByText("Here are some picks")).toBeInTheDocument();
    expect(mockedAiSearch).toHaveBeenCalledTimes(1);
  });

  it("still shows the thinking indicator when returning mid-request", async () => {
    mockedAiSearch.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    const { unmount } = renderAiChat();

    await screen.findByPlaceholderText("Ask about a movie...");
    await user.click(
      screen.getByRole("button", {
        name: "Suggest a mind-bending sci-fi movie",
      }),
    );
    await waitFor(() => expect(mockedAiSearch).toHaveBeenCalledTimes(1));

    unmount();
    renderAiChat();

    expect(
      await screen.findByPlaceholderText("Thinking..."),
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

  describe("photo identify", () => {
    it("uploads a photo and shows the identified movie card", async () => {
      mockedIdentifyPhoto.mockResolvedValue({
        message: "This looks like Inception (2010).",
        movies: [
          {
            id: 27205,
            title: "Inception",
            mediaType: "movie",
          } as MovieResult,
        ],
      });
      const user = userEvent.setup();
      renderAiChat();

      const input = await screen.findByPlaceholderText("Ask about a movie...");
      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(["fake"], "screenshot.jpg", {
        type: "image/jpeg",
      });
      await user.upload(fileInput, file);

      // The photo isn't sent on attach- it waits for the user to (optionally)
      // add a note and submit, just like a typed message.
      expect(mockedIdentifyPhoto).not.toHaveBeenCalled();
      fireEvent.submit(input.closest("form")!);

      expect(mockedIdentifyPhoto).toHaveBeenCalledWith(file, "", "en");
      expect(
        await screen.findByText("This looks like Inception (2010)."),
      ).toBeInTheDocument();
      expect(screen.getByText("Inception")).toBeInTheDocument();
    });

    it("sends the typed note along with the attached photo", async () => {
      mockedIdentifyPhoto.mockResolvedValue({
        message: "This looks like Inception (2010).",
      });
      const user = userEvent.setup();
      renderAiChat();

      const input = await screen.findByPlaceholderText("Ask about a movie...");
      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(["fake"], "screenshot.jpg", {
        type: "image/jpeg",
      });
      await user.upload(fileInput, file);
      // fireEvent.change instead of user.type: this input's onFocus schedules
      // a one-off blur/refocus (an iOS caret-position workaround) that races
      // with userEvent's per-keystroke typing and can drop characters.
      fireEvent.change(input, {
        target: { value: "is this a christopher nolan movie?" },
      });
      fireEvent.submit(input.closest("form")!);

      expect(mockedIdentifyPhoto).toHaveBeenCalledWith(
        file,
        "is this a christopher nolan movie?",
        "en",
      );
    });

    it("rejects an unsupported file type without calling the API", async () => {
      // applyAccept:false- the input's own accept="image/jpeg,image/png,image/webp"
      // would otherwise make userEvent silently refuse to attach a .gif at all,
      // so the app's own validation (which is what this test targets) never runs.
      const user = userEvent.setup({ applyAccept: false });
      renderAiChat();

      await screen.findByPlaceholderText("Ask about a movie...");
      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(["fake"], "clip.gif", { type: "image/gif" });
      await user.upload(fileInput, file);

      expect(
        await screen.findByText(
          "Please upload a JPEG, PNG, or WebP image.",
        ),
      ).toBeInTheDocument();
      expect(mockedIdentifyPhoto).not.toHaveBeenCalled();
    });

    it("shows the photo daily-limit error when the API responds with 429", async () => {
      mockedIdentifyPhoto.mockRejectedValue({ response: { status: 429 } });
      const user = userEvent.setup();
      renderAiChat();

      const input = await screen.findByPlaceholderText("Ask about a movie...");
      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(["fake"], "screenshot.png", {
        type: "image/png",
      });
      await user.upload(fileInput, file);
      fireEvent.submit(input.closest("form")!);

      expect(
        await screen.findByText(
          "You've reached today's photo-identify limit (3/day). Please come back tomorrow.",
        ),
      ).toBeInTheDocument();
    });
  });
});
