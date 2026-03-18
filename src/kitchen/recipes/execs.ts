import { CommandExecutor } from "../commandExecutor";
import { flattenObjectDot } from "../helpers";
import { v4 as uuidv4 } from "uuid";
import { exec } from "child_process";
import { getLLMResponse } from "@koko420/ai-tools";
import { getTranslationSystemMessage } from "../../ai/translations";
import z from "zod";
import { retry } from "@koko420/shared";
import {
  setAllLightsState,
  setRoomLightsState,
  setAllLightsBrightness,
  setRoomLightsBrightness,
  listRooms,
  parseBrightnessAndColor,
} from "../../helpers/wiz";
import { getWizGroups, getApiKey } from "../grimoireSettings";
import { showWizSetup } from "../../views/wizSetup";
import {
  turnOnTV,
  turnOffTV,
  turnOnTVScreen,
  turnOffTVScreen,
  setTVVolume,
  setupTV,
  launchTVApp,
  listTVApps,
  openTVBrowser,
  openYouTube,
  openSpotify,
} from "../../helpers/lg";
import { showCommandFormWindow } from "../../views/commandForm";
import {
  turnOnAC,
  turnOffAC,
  setACTemp,
  setACMode,
  setACFanRate,
  setACFanDirection,
  listDevices,
  getAuthUrl,
  authorizeWithCode,
} from "../../helpers/daikin";
import {
  getCoverLetterSystemMessage,
  getEmailComposeLanguageSystemMessage,
  getEmailComposeSystemMessage,
  getEmailReplySystemMessage,
  getJobQuestionAnswerSystemMessage,
  getLinkedinReplySystemMessage,
  getSlackReplySystemMessage,
} from "../../ai/replies";
import { summarizeTextSystemMessage } from "../../ai/summaries";
import {
  CommandSystemMessage,
  JavaScriptSystemMessage,
  TypeScriptSystemMessage,
} from "../../ai/code";
import {
  getAnimeSearchLink,
  getPiratebaySearchLink,
} from "../../helpers/getLinks";
import { getPageHTMLWithJS } from "../../helpers/getPageHtml";
import { parse } from "node-html-parser";
import {
  getAnimeSystemMessage,
  getMovieSystemMessage,
} from "../../ai/commands";
import path from "path";
import os from "os";
import { downloadMovie } from "../../helpers/webtorrent/downloadMovie";
import { startTransferServer } from "../../helpers/transfer/transferServer";
import { streamMovie } from "../../helpers/webtorrent/streamMovie";
import { parseSearchQuery } from "../../helpers/webtorrent/parseSearchQuery";
import { downloadMovieSubs } from "../../helpers/subs/downloadSubs";
import {
  SupportedLanguage,
  isSupportedLanguage,
} from "../../helpers/subs/opensubtitles";
import {
  playSpotify,
  pauseSpotify,
  resumeSpotify,
  switchSpotifyDevice,
  listSpotifyDevices,
  authorizeSpotify,
  exchangeCodeForTokens,
} from "../../helpers/spotify";
import { addToWatchHistory } from "../../helpers/webtorrent/watchHistory";
import { showWatchHistory } from "../../views/watchHistory";
import { streamScreen } from "../../helpers/screenStream/streamScreen";
import {
  getActiveProcesses,
  removeActiveProcess,
} from "../../electron/tray";

// Helper to find and stream a movie torrent
const streamMovieTorrent = async (
  args: string[] | undefined,
  onStreamReady?: (url: string) => void
): Promise<string | null> => {
  if (!args || !args[0]) return null;
  const text = args.join(" ");
  const subsLanguage = (text.split(" -")[1] ?? "eng").trim();
  if (!isSupportedLanguage(subsLanguage)) {
    return `Invalid subtitle language: ${subsLanguage}`;
  }
  const title = text.split(" -")[0].trim();
  if (!title) return "no movie title provided";

  // Inner function to allow recursion for next episode
  const startStream = async (searchTitle: string): Promise<string | null> => {
    const { searchText } = parseSearchQuery(searchTitle);
    console.log("searching torrent for ", searchText);
    const link = await getPiratebaySearchLink(searchText);
    const {
      elementsHTML: selectedItemsElementsHTML,
      text: selectedItemsHTML,
    } = await getPageHTMLWithJS({
      url: link,
      selector: "ol li",
      limit: 20,
      skip: 1,
      returnOuterHTML: true,
    });

    if (selectedItemsHTML.length === 0) {
      return null;
    }

    const { index } = await retry(
      async () => {
        return getLLMResponse({
          systemMessage: await getMovieSystemMessage(selectedItemsHTML),
          userMessage: searchTitle,
          schema: z.object({
            index: z.number(),
          }),
        });
      },
      3,
      false
    );

    const selectedItem = selectedItemsElementsHTML[index];
    if (!selectedItem) return null;
    if (selectedItem.indexOf("00000000000000") !== -1) return null;

    const magnetLink = parse(selectedItem).querySelector('a[href^="magnet:?"]');
    if (!magnetLink) return null;
    const magnetLinkUrl = magnetLink.getAttribute("href");
    if (!magnetLinkUrl) return null;

    const downloadPath = path.join(os.homedir(), "Downloads", "movies");

    // Add to watch history
    addToWatchHistory(searchTitle, "movie");

    await streamMovie({
      magnetLinkUrl,
      downloadPath,
      searchQuery: searchTitle,
      subsLanguage,
      onStreamReady,
      onStartNextEpisode: (nextTitle) => {
        // Recursively start the next episode stream
        startStream(nextTitle);
      },
    });

    return `Stream started: ${magnetLinkUrl.split("&")[0].substring(0, 60)}...`;
  };

  return startStream(title);
};

// Helper to find and stream an anime torrent
const streamAnimeTorrent = async (
  args: string[] | undefined,
  onStreamReady?: (url: string) => void
): Promise<string | null> => {
  if (!args || !args[0]) return null;
  const text = args.join(" ");
  const subsLanguage = (text.split(" -")[1] ?? "eng").trim();
  if (!isSupportedLanguage(subsLanguage)) {
    return `Invalid subtitle language: ${subsLanguage}`;
  }
  const title = text.split(" -")[0].trim();
  if (!title) return "no anime title provided";

  // Inner function to allow recursion for next episode
  const startStream = async (searchTitle: string): Promise<string | null> => {
    const { searchText, season, episode } = parseSearchQuery(searchTitle, true);

    const searchPages = async (
      withSeasonEpisode: boolean
    ): Promise<string | null> => {
      let page = 1;
      while (true) {
        const link = await getAnimeSearchLink({
          search: searchText,
          page,
          ...(withSeasonEpisode && {
            season: season ?? undefined,
            episode: episode ?? undefined,
          }),
        });

        const {
          elementsHTML: selectedItemsElementsHTML,
          text: selectedItemsHTML,
        } = await getPageHTMLWithJS({
          url: link,
          selector: "tbody tr",
          limit: 50,
          skip: 1,
          returnOuterHTML: true,
        });

        if (selectedItemsHTML.length === 0) return null;

        const { index } = await retry(
          async () => {
            return getLLMResponse({
              systemMessage: await getAnimeSystemMessage(selectedItemsHTML),
              userMessage: searchTitle,
              schema: z.object({
                index: z.number(),
              }),
            });
          },
          3,
          false
        );

        const selectedItem = selectedItemsElementsHTML[index];
        if (selectedItem) {
          const magnetLink = parse(selectedItem).querySelector(
            'a[href^="magnet:?"]'
          );
          const url = magnetLink?.getAttribute("href");
          if (url) return url;
        }

        page++;
      }
    };

    let magnetLinkUrl: string | null = null;
    if (season || episode) {
      magnetLinkUrl = await searchPages(true);
    }
    if (!magnetLinkUrl) {
      magnetLinkUrl = await searchPages(false);
    }
    if (!magnetLinkUrl) return null;

    const downloadPath = path.join(os.homedir(), "Downloads", "movies");

    // Add to watch history
    addToWatchHistory(searchTitle, "anime");

    await streamMovie({
      magnetLinkUrl,
      downloadPath,
      searchQuery: searchTitle,
      subsLanguage,
      isAnime: true,
      onStreamReady,
      onStartNextEpisode: (nextTitle) => {
        // Recursively start the next episode stream
        startStream(nextTitle);
      },
    });

    return `Stream started: ${magnetLinkUrl.split("&")[0].substring(0, 60)}...`;
  };

  return startStream(title);
};

// Helper to create room-specific commands
const createRoomCommands = (
  roomName: string
): Record<string, CommandExecutor> => ({
  off: [async () => setRoomLightsState(roomName, false)],
  on: [async () => setRoomLightsState(roomName, true)],
  to: [
    async (args?: string[]) => {
      // Split the first arg by spaces, or use empty array if no args
      const parts = args?.[0]?.split(" ").filter((p) => p.trim() !== "") ?? [];
      const result = parseBrightnessAndColor(parts, true);

      if (typeof result === "string") return result;

      // If neither provided, set both to defaults
      if (result.brightness === undefined && !result.color) {
        return setRoomLightsBrightness(roomName, 50, "default");
      }

      // Otherwise pass what was provided (undefined means keep current)
      return setRoomLightsBrightness(
        roomName,
        result.brightness,
        result.color
      );
    },
    "brightness?: number (0-100), color?: string | scene (default: 50 default)",
  ],
});

export const execsPerCategory: Record<
  string,
  Record<string, CommandExecutor | Record<string, CommandExecutor>>
> = {
  generate: {
    uuid: [() => uuidv4()],
    timestamp: [() => new Date().toISOString()],

    // example named params
    fnNamedParamsExample: [
      (someParams) => someParams?.[0] ?? "",
      "firstParamName: string[]",
    ],
  },
  cmd: {
    kill: [
      (args?: string[]) => {
        const port = args?.[0] ?? "3000";
        if (!port) return;
        exec(`kill -9 $(lsof -t -i:${port})`);
      },
      "port: string",
    ],
  },
  ai: {
    translate: [
      async (args?: string[]) => {
        if (!args) return "no language and text provided";
        const [language, ...texts] = args[0]?.split(" ") ?? [];

        if (!language) return "no language provided";
        if (!texts.length) return "no text to translate provided";

        const result = await retry(
          () => {
            return getLLMResponse({
              systemMessage: getTranslationSystemMessage("text", language),
              userMessage: texts.join(" "),
              schema: z.object({
                text: z.string(),
              }),
            });
          },
          3,
          false
        );

        return result.text;
      },
      "language: string",
      "text: string",
    ],
    summarize: [
      async (args?: string[]) => {
        if (!args || !args[0]) return "no text provided";
        const text = args.join(" ");

        if (!text) return "no text provided";

        const result = await retry(
          () => {
            return getLLMResponse({
              systemMessage: summarizeTextSystemMessage,
              userMessage: text,
              schema: z.object({
                summary: z.string(),
              }),
            });
          },
          3,
          false
        );

        return result.summary;
      },
      "text: string",
    ],
  },
  email: {
    reply: [
      async (args?: string[]) => {
        if (!args || !args[0]) return "no email text provided";
        const emailText = args.join(" ");

        if (!emailText) return "no email text provided";

        const result = await retry(
          () => {
            return getLLMResponse({
              systemMessage: getEmailReplySystemMessage,
              userMessage: emailText,
              schema: z.object({
                reply: z.string(),
              }),
            });
          },
          3,
          false
        );

        console.log("result", result);

        return result.reply;
      },
      "email text: string",
    ],
    compose: [
      async (args?: string[]) => {
        if (!args || !args[0]) return "no email topic provided";
        const emailTopic = args.join(" ");

        if (!emailTopic) return "no email topic provided";

        const result = await retry(
          () => {
            return getLLMResponse({
              systemMessage: getEmailComposeSystemMessage({
                name: "John Doe",
                role: "Software Engineer",
                company: "Google",
                location: "San Francisco, CA",
                industry: "Technology",
                experience: "10 years",
                education: "Bachelor of Science in Computer Science",
                skills: "JavaScript, Python, React, Node.js",
              }),
              userMessage: emailTopic,
              schema: z.object({
                reply: z.string(),
              }),
            });
          },
          3,
          false
        );

        console.log("result", result);

        return result.reply;
      },
      "email topic: string",
    ],
  },

  linkedin: {
    reply: [
      async (args?: string[]) => {
        if (!args || !args[0]) return "no message provided";
        const message = args.join(" ");
        if (!message) return "no message provided";

        const result = await retry(
          async () => {
            return getLLMResponse({
              systemMessage: await getLinkedinReplySystemMessage(),
              userMessage: message,
              schema: z.object({
                reply: z.string(),
              }),
            });
          },
          3,
          false
        );

        return result.reply;
      },
      "message: string",
    ],
  },
  slack: {
    reply: [
      async (args?: string[]) => {
        if (!args || !args[0]) return "no slack message provided";
        const message = args.join(" ");
        if (!message) return "no slack message provided";

        const result = await retry(
          async () => {
            return getLLMResponse({
              systemMessage: getSlackReplySystemMessage,
              userMessage: message,
              schema: z.object({
                reply: z.string(),
              }),
            });
          },
          3,
          false
        );

        return result.reply;
      },
      "message: string",
    ],
  },
  code: {
    js: [
      async (args?: string[]) => {
        const specification = args?.[0] ?? "";
        if (!specification) return "no specification provided";

        const result = await retry(
          () => {
            return getLLMResponse({
              systemMessage: JavaScriptSystemMessage,
              userMessage: specification,
              schema: z.object({
                code: z.string(),
              }),
            });
          },
          3,
          false
        );

        return result.code;
      },
      "specification: string",
    ],
    ts: [
      async (args?: string[]) => {
        const specification = args?.[0] ?? "";
        if (!specification) return "no specification provided";

        const result = await retry(
          () => {
            return getLLMResponse({
              systemMessage: TypeScriptSystemMessage,
              userMessage: specification,
              schema: z.object({
                code: z.string(),
              }),
            });
          },
          3,
          false
        );

        return result.code;
      },
      "specification: string",
    ],
    cmd: [
      async (args?: string[]) => {
        if (!args || !args[0]) return "no command descriotor provided";
        const commandDescription = args.join(" ");
        if (!commandDescription) return "no command descriptor provided";
        const result = await retry(
          async () => {
            return getLLMResponse({
              systemMessage: CommandSystemMessage,
              userMessage: commandDescription,
              schema: z.object({
                command: z.string(),
              }),
            });
          },
          3,
          false
        );

        return result.command;
      },
      "command descriptor: string",
    ],
  },
  translate: {
    // populated by setupLanguageTranslationCommands
  },
  job_hunt: {
    cover_letter: [
      async (args?: string[]) => {
        if (!args || !args[0]) return "no job description provided";
        const jobDescription = args.join(" ");
        if (!jobDescription) return "no job description provided";

        const result = await retry(
          async () => {
            return getLLMResponse({
              systemMessage: await getCoverLetterSystemMessage(),
              userMessage: jobDescription,
              schema: z.object({
                cover_letter: z.string(),
              }),
            });
          },
          3,
          false
        );

        return result.cover_letter;
      },
      "job description: string",
    ],
    role_question: [
      async (args?: string[]) => {
        if (!args || !args[0]) return "no question provided";
        const question = args.join(" ");
        if (!question) return "no question provided";

        const result = await retry(
          async () => {
            return getLLMResponse({
              systemMessage: await getJobQuestionAnswerSystemMessage(),
              userMessage: question,
              schema: z.object({
                role_question: z.string(),
              }),
            });
          },
          3,
          false
        );

        return result.role_question;
      },
      "question: string",
    ],
  },
  movie: {
    stream: [
      async (args?: string[]) => streamMovieTorrent(args),
      "title: string, subs-language?: -eng | -bul | -ita",
    ],
    download: [
      async (args?: string[]) => {
        if (!args || !args[0]) return null;
        const text = args.join(" ");
        if (!text) return null;

        const { searchText } = parseSearchQuery(text);
        const link = await getPiratebaySearchLink(searchText);
        const {
          elementsHTML: selectedItemsElementsHTML,
          text: selectedItemsHTML,
        } = await getPageHTMLWithJS({
          url: link,
          selector: "ol li",
          limit: 10, // 10 <li>'s
          skip: 1, // skip from the Nth <li>
          returnOuterHTML: true,
        });

        if (selectedItemsHTML.length === 0) {
          return null;
        }

        const { index } = await retry(
          async () => {
            return getLLMResponse({
              systemMessage: await getMovieSystemMessage(selectedItemsHTML),
              userMessage: text,
              schema: z.object({
                index: z.number(),
              }),
            });
          },
          3,
          false
        );

        const selectedItem = selectedItemsElementsHTML[index];
        if (!selectedItem) {
          return null;
        }

        if (selectedItem.indexOf("00000000000000") !== -1) {
          return null;
        }
        console.log("selectedItem", selectedItem.outerHTML);

        const magnetLink = parse(selectedItem).querySelector(
          'a[href^="magnet:?"]'
        );
        if (!magnetLink) return null;
        const magnetLinkUrl = magnetLink.getAttribute("href");
        if (!magnetLinkUrl) return null;

        // download the torrent (non-blocking)
        const downloadPath = path.join(os.homedir(), "Downloads", "movies");

        downloadMovie({ magnetLinkUrl, downloadPath, searchQuery: text });

        // Open Finder at downloads folder immediately
        exec(`open "${downloadPath}"`);

        return `Download started for: ${magnetLinkUrl.split("&")[0].substring(0, 60)}...`;
      },
      "title: string, year?: number",
    ],
    subs: [
      async (args?: string[]) => {
        if (!args || !args[0]) return "no movie title provided";
        const text = args.join(" ");
        const subsLanguage = text.split(" -")[1] ?? "eng";
        const title = text.split(" -")[0];
        if (!title) return "no movie title provided";

        const result = await downloadMovieSubs(title, {
          languages: [subsLanguage as SupportedLanguage], // will pick any if many provided.
        });

        if (result.alreadyExists) {
          return `Subtitle already exists: ${result.paths?.join(", ")}`;
        }

        if (!result.success) {
          return `Failed to download subtitle: ${result.error}`;
        }

        return `Subtitle downloaded: ${result.paths?.join(", ")}`;
      },
      "title: string, subs-language?: -eng | -bul | -ita",
    ],
  },
  anime: {
    stream: [
      async (args?: string[]) => streamAnimeTorrent(args),
      "title: string, subsLanguage?: -eng | -bul | -ita",
    ],
    download: [
      async (args?: string[]) => {
        if (!args || !args[0]) return null;
        const text = args.join(" ");
        if (!text) return null;

        const { searchText, season, episode } = parseSearchQuery(text, true);

        const searchPages = async (
          withSeasonEpisode: boolean
        ): Promise<string | null> => {
          let page = 1;
          while (true) {
            const link = await getAnimeSearchLink({
              search: searchText,
              page,
              ...(withSeasonEpisode && {
                season: season ?? undefined,
                episode: episode ?? undefined,
              }),
            });
            console.log(
              `searching anime download page ${page}${withSeasonEpisode ? " (with S/E)" : ""}: ${link}`
            );

            const {
              elementsHTML: selectedItemsElementsHTML,
              text: selectedItemsHTML,
            } = await getPageHTMLWithJS({
              url: link,
              selector: "tbody tr",
              limit: 50,
              skip: 1,
              returnOuterHTML: true,
            });

            if (selectedItemsHTML.length === 0) {
              return null;
            }

            const { index } = await retry(
              async () => {
                return getLLMResponse({
                  systemMessage: await getAnimeSystemMessage(selectedItemsHTML),
                  userMessage: text,
                  schema: z.object({
                    index: z.number(),
                  }),
                });
              },
              3,
              false
            );

            const selectedItem = selectedItemsElementsHTML[index];
            if (selectedItem) {
              const magnetLink = parse(selectedItem).querySelector(
                'a[href^="magnet:?"]'
              );
              const url = magnetLink?.getAttribute("href");
              if (url) return url;
            }

            console.log(`No valid selection on page ${page}, trying next...`);
            page++;
          }
        };

        let magnetLinkUrl: string | null = null;
        if (season || episode) {
          magnetLinkUrl = await searchPages(true);
        }

        if (!magnetLinkUrl) {
          console.log("Falling back to search without season/episode...");
          magnetLinkUrl = await searchPages(false);
        }

        if (!magnetLinkUrl) return null;

        // download the torrent (non-blocking)
        const downloadPath = path.join(os.homedir(), "Downloads", "movies");

        downloadMovie({ magnetLinkUrl, downloadPath, searchQuery: text });

        // Open Finder at downloads folder immediately
        exec(`open "${downloadPath}"`);

        return `Download started for: ${magnetLinkUrl.split("&")[0].substring(0, 60)}...`;
      },
      "title: string, S_E_: string",
    ],
  },
  media: {
    watch_history: [
      async () => {
        showWatchHistory();
        return "Opening watch history...";
      },
    ],
    end_streams: [
      async () => {
        const processes = getActiveProcesses();
        const streamAndDownloadProcesses = processes.filter(
          (p) => p.type === "stream" || p.type === "download"
        );

        if (streamAndDownloadProcesses.length === 0) {
          return "No active streams or downloads to stop.";
        }

        for (const process of streamAndDownloadProcesses) {
          console.log(`Stopping ${process.type}: ${process.name}`);
          process.cleanup();
          removeActiveProcess(process.id);
        }

        return `Stopped ${streamAndDownloadProcesses.length} active stream(s)/download(s).`;
      },
    ],
  },
  transfer: {
    server: [async () => startTransferServer()],
  },
  tv: {
    movie_stream: [
      async (args?: string[]) => {
        console.log("[TV] Starting movie stream with args:", args);
        return streamMovieTorrent(args, (url) => {
          console.log("[TV] Stream ready, opening TV browser:", url);
          openTVBrowser(url);
          setAllLightsState(false).then(() => console.log("Lights off for movie"));
        });
      },
      "title: string, subs-language?: -eng | -bul | -ita",
    ],
    anime_stream: [
      async (args?: string[]) => {
        console.log("[TV] Starting anime stream with args:", args);
        return streamAnimeTorrent(args, (url) => {
          console.log("[TV] Stream ready, opening TV browser:", url);
          openTVBrowser(url);
          setAllLightsState(false).then(() => console.log("Lights off for anime"));
        });
      },
      "title: string, subsLanguage?: -eng | -bul | -ita",
    ],
    screen_stream: [
      async () => {
        console.log("[TV] Starting screen stream");
        return streamScreen({
          onStreamReady: (url) => {
            console.log("[TV] Screen stream ready, opening TV browser:", url);
            openTVBrowser(url);
          },
        });
      },
    ],
  },
  laptop: {
    movie_stream: [
      async (args?: string[]) => {
        console.log("[Laptop] Starting movie stream with args:", args);
        return streamMovieTorrent(args, (url) => {
          console.log("[Laptop] Stream ready, opening browser:", url);
          exec(`open "${url}"`);
        });
      },
      "title: string, subs-language?: -eng | -bul | -ita",
    ],
    anime_stream: [
      async (args?: string[]) => {
        console.log("[Laptop] Starting anime stream with args:", args);
        return streamAnimeTorrent(args, (url) => {
          console.log("[Laptop] Stream ready, opening browser:", url);
          exec(`open "${url}"`);
        });
      },
      "title: string, subsLanguage?: -eng | -bul | -ita",
    ],
  },
  spotify: {
    authorize: [
      () => {
        authorizeSpotify((url) => exec(`open "${url}"`))
          .then((msg) => console.log("[Spotify]", msg))
          .catch((err) => console.error("[Spotify] auth failed:", err));
        return "Opening Spotify auth in browser... approve the permissions and the token will be saved automatically.";
      },
    ],
    code: [
      async (args?: string[]) => {
        const code = args?.[0];
        if (!code) return "no authorization code provided";
        await exchangeCodeForTokens(code);
        return "Spotify authorized! Refresh token saved to Grimoire Settings.";
      },
      "code: string",
    ],
    devices: [async () => listSpotifyDevices()],
    play: [
      async (args?: string[]) => {
        if (!args || args.length === 0)
          return "no keyword or song name provided";

        let keyword = "";
        let random = false;
        let trackIndex: number | undefined;

        for (let i = 0; i < args.length; i++) {
          const arg = args[i];
          if (arg === "-random" || arg === "-r") {
            random = true;
          } else if (
            (arg === "-number" || arg === "-n") &&
            i + 1 < args.length
          ) {
            const num = parseInt(args[i + 1], 10);
            if (!isNaN(num)) {
              trackIndex = num;
              i++;
            }
          } else {
            keyword += (keyword ? " " : "") + arg;
          }
        }

        if (!keyword) return "no keyword or song name provided";

        return playSpotify(keyword, random, trackIndex);
      },
      "keyword or song: string, -random|-r?: flag, -number|-n <index>?: number",
    ],
    pause: [async () => pauseSpotify()],
    resume: [async () => resumeSpotify()],
    switch_device: [
      async (args?: string[]) => {
        if (!args || args.length === 0) return "no device name provided";
        return switchSpotifyDevice(args.join(" "));
      },
      "device name: string",
    ],
    tv_play: [
      async (args?: string[]) => {
        if (!args || args.length === 0)
          return "no keyword or song name provided";

        let keyword = "";
        let random = false;
        let trackIndex: number | undefined;

        for (let i = 0; i < args.length; i++) {
          const arg = args[i];
          if (arg === "-random" || arg === "-r") {
            random = true;
          } else if (
            (arg === "-number" || arg === "-n") &&
            i + 1 < args.length
          ) {
            const num = parseInt(args[i + 1], 10);
            if (!isNaN(num)) {
              trackIndex = num;
              i++;
            }
          } else {
            keyword += (keyword ? " " : "") + arg;
          }
        }

        if (!keyword) return "no keyword or song name provided";

        return playSpotify(keyword, random, trackIndex, getApiKey("SPOTIFY_TV_DEVICE_NAME") || undefined);
      },
      "keyword or song: string, -random|-r?: flag, -number|-n <index>?: number",
    ],
  },
  home: {
    // Global lights commands
    lights_off: [async () => setAllLightsState(false)],
    lights_on: [async () => setAllLightsState(true)],
    lights_to: [
      async (args?: string[]) => {
        // Split the first arg by spaces, or use empty array if no args
        const parts =
          args?.[0]?.split(" ").filter((p) => p.trim() !== "") ?? [];
        const result = parseBrightnessAndColor(parts, true);

        if (typeof result === "string") return result;

        // If neither provided, set both to defaults
        if (result.brightness === undefined && !result.color) {
          return setAllLightsBrightness(50, "default");
        }

        // Otherwise pass what was provided (undefined means keep current)
        return setAllLightsBrightness(result.brightness, result.color);
      },
      "brightness?: number (0-100), color?: string | scene (default: 50 default)",
    ],

    // Room subcategories are injected dynamically below via setupWizGroupCommands()

    // TV subcategory
    tv: {
      on: [async () => turnOnTV()],
      off: [async () => turnOffTV()],
      screen_on: [async () => turnOnTVScreen()],
      screen_off: [async () => turnOffTVScreen()],
      volume: [
        async (args?: string[]) => {
          const volume = parseInt(args?.[0] ?? "20", 10);
          if (isNaN(volume)) return "invalid volume number";
          return setTVVolume(volume);
        },
        "volume: number",
      ],
      app: [
        async (args?: string[]) => {
          const appIdOrName = args?.[0];
          if (!appIdOrName) return "no app ID or name provided";
          return launchTVApp(appIdOrName);
        },
        "appId or appName: string",
      ],
      list_apps: [async () => listTVApps()],
      browser: [
        async (args?: string[]) => {
          const url = args?.[0];
          if (!url) return "no URL provided";
          return openTVBrowser(url);
        },
        "url: string",
      ],
      youtube: [
        async (args?: string[]) => {
          if (!args || args.length === 0)
            return "no search query or video provided";
          const query = args.join(" ");
          return openYouTube(query);
        },
        "videoId or search: string",
      ],
      spotify: [
        async (args?: string[]) => {
          if (!args || args.length === 0) return "no search query provided";
          const query = args.join(" ");
          return openSpotify(query);
        },
        "search: string",
      ],
      play_spotify: [
        async (args?: string[]) => {
          if (!args || args.length === 0) return "no song name provided";
          const song = args.join(" ");
          await launchTVApp("spotify");
          await turnOnTVScreen().catch(() => { });
          // await new Promise((resolve) => setTimeout(resolve, 3000));
          const result = await playSpotify(song, false, undefined, getApiKey("SPOTIFY_TV_DEVICE_NAME") || undefined);
          return result;
        },
        "song: string",
      ],
      play_spotify_dim: [
        async (args?: string[]) => {
          if (!args) return "usage: play_spotify_dim <brightness> <color> <song name>";
          const [brightnessStr, color, ...songParts] = args[0].split(" ");
          const brightness = parseInt(brightnessStr, 10);
          console.log("Setting lights brightness and color to", brightness, color);
          if (isNaN(brightness) || brightness < 0 || brightness > 100) return "brightness must be 0-100";
          const song = songParts.join(" ");
          if (!song) return "no song name provided";

          await setRoomLightsBrightness("living-room-all", brightness, color).catch(() => { });
          await setRoomLightsBrightness("kitchen", brightness, color).catch(() => { });

          await launchTVApp("spotify");
          // await new Promise((resolve) => setTimeout(resolve, 3000));
          const result = await playSpotify(song, false, undefined, getApiKey("SPOTIFY_TV_DEVICE_NAME") || undefined);
          await turnOnTVScreen().catch(() => { });
          return result;
        },
        "brightness: number (0-100), color: string, song: string",
      ],
      pause_spotify: [async () => pauseSpotify()],
      resume_spotify: [async () => resumeSpotify()],
      setup: [
        async (args?: string[]) => {
          const force = args?.[0] === "force";
          return setupTV(force);
        },
        "force?: string",
      ],
    }, // Aircon subcategory
    aircon: {
      on: [
        async (args?: string[]) => {
          const room = args?.[0];
          return turnOnAC(room);
        },
        "room?: living room | office | bedroom",
      ],
      off: [
        async (args?: string[]) => {
          const room = args?.[0];
          return turnOffAC(room);
        },
        "room?: living room | office | bedroom",
      ],
      temp: [
        async (args?: string[]) => {
          if (!args || args.length === 0) return "no temperature provided";
          const lastArg = args[args.length - 1];
          const temp = parseInt(lastArg, 10);
          if (isNaN(temp)) return "invalid temperature";

          const room =
            args.length > 1 ? args.slice(0, -1).join(" ") : undefined;
          return setACTemp(room, temp);
        },
        "room?: string, temp: number (16-32°C)",
      ],
      mode: [
        async (args?: string[]) => {
          if (!args || args.length === 0) return "no mode provided";
          const lastArg = args[args.length - 1].toLowerCase();
          const validModes = ["cool", "heat", "auto", "dry", "fan"];

          if (!validModes.includes(lastArg)) {
            return `invalid mode. Use: ${validModes.join(", ")}`;
          }

          const room =
            args.length > 1 ? args.slice(0, -1).join(" ") : undefined;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return setACMode(room, lastArg as any);
        },
        "room?: string, mode: cool | heat | auto | dry | fan",
      ],
      fan_rate: [
        async (args?: string[]) => {
          if (!args || args.length === 0) return "no fan rate provided";
          const lastArg = args[args.length - 1];
          const rate = parseInt(lastArg, 10);
          if (isNaN(rate) || rate < 1 || rate > 5)
            return "fan rate must be 1-5";

          const room =
            args.length > 1 ? args.slice(0, -1).join(" ") : undefined;
          return setACFanRate(room, rate);
        },
        "room?: string, rate: 1-5",
      ],
      fan_dir: [
        async (args?: string[]) => {
          if (!args || args.length === 0) return "no fan direction provided";
          const lastArg = args[args.length - 1];
          const dir = parseInt(lastArg, 10);
          if (isNaN(dir) || dir < 0 || dir > 5)
            return "fan direction must be 0-5";

          const room =
            args.length > 1 ? args.slice(0, -1).join(" ") : undefined;
          return setACFanDirection(room, dir);
        },
        "room?: string, direction: 0-5",
      ],
      list: [async () => listDevices()],
      authorize: [async () => getAuthUrl()],
      code: [
        async (args?: string[]) => {
          const code = args?.[0];
          if (!code) return "no authorization code provided";
          return authorizeWithCode(code);
        },
        "code: string",
      ],
    },
  },
  wiz: {
    list_rooms: [async () => listRooms()],
    setup: [() => { showWizSetup(); return "Opening Wiz Setup..."; }],
  },
  development: {},
};

// Inject room subcategories into home from wizGroups config
const setupWizGroupCommands = () => {
  const groups = getWizGroups();
  const home = execsPerCategory.home;
  // Remove stale dynamic group keys (keep known static keys)
  const staticKeys = new Set([
    "lights_off", "lights_on", "lights_to",
    "tv", "aircon",
  ]);
  for (const key of Object.keys(home)) {
    if (!staticKeys.has(key) && typeof home[key] === "object" && !Array.isArray(home[key])) {
      // Check if it looks like a room command set (has on/off/to)
      const sub = home[key] as Record<string, unknown>;
      if (sub.on && sub.off && sub.to) delete home[key];
    }
  }
  for (const group of groups) {
    const key = group.name.toLowerCase().replace(/\s+/g, "-");
    home[key] = createRoomCommands(group.name);
  }
};
setupWizGroupCommands();

// Re-inject room commands when settings change (e.g. user saves groups in Wiz Setup UI)
import { onSettingsChange } from "../grimoireSettings";
onSettingsChange(() => {
  setupWizGroupCommands();
  refreshExecs();
});

// Remove development commands in production
if (process.env.NODE_ENV !== "development") {
  delete execsPerCategory.development;
}

const LANGUAGES = [
  "italian",
  "bulgarian",
  "spanish",
  "english",
  "german",
  "french",
  "portuguese",
  "russian",
  "chinese",
  "japanese",
  "korean",
  "arabic",
  "hindi",
  "bengali",
  "turkish",
  "indonesian",
  "malay",
  "thai",
  "vietnamese",
  "filipino",
  "malaysian",
  "singaporean",
  "taiwanese",
];

const setupLanguageTranslationCommands = () => {
  const curryExec = (language: string) => async (args?: string[]) => {
    const text = args?.[0] ?? "";
    const translateCmd = execsPerCategory.ai.translate as CommandExecutor;
    return translateCmd[0]([language + " " + text]);
  };

  const cmds = LANGUAGES.reduce(
    (acc, language) => {
      acc[language] = [curryExec(language), "text: string"];
      return acc;
    },
    {} as Record<string, [ReturnType<typeof curryExec>, string]>
  );

  execsPerCategory.translate = {
    ...execsPerCategory.translate,
    ...cmds,
  };
};
setupLanguageTranslationCommands();

const setupEmailComposeCommands = () => {
  const curryExec = (language: string) => async (args?: string[]) => {
    if (!args || !args[0]) return "no message provided";
    const message = args.join(" ");
    if (!message) return "no message provided";

    const result = await retry(
      () => {
        return getLLMResponse({
          systemMessage: getEmailComposeLanguageSystemMessage(language),
          userMessage: message,
          schema: z.object({
            email: z.string(),
          }),
        });
      },
      3,
      false
    );

    return result.email;
  };

  const cmds = LANGUAGES.reduce(
    (acc, language) => {
      acc[`compose_${language}`] = [curryExec(language), "message: string"];
      return acc;
    },
    {} as Record<string, [ReturnType<typeof curryExec>, string]>
  );

  execsPerCategory.email = {
    ...execsPerCategory.email,
    ...cmds,
  };
};
setupEmailComposeCommands();

export let execs = flattenObjectDot(execsPerCategory);

export const refreshExecs = () => {
  execs = flattenObjectDot(execsPerCategory);
};

// Descriptions for commands (key matches fullKey like "lights.off" or "ai.translate")
export const execDescriptions: Record<string, string> = {
  // Lights
  "lights.off": "Turn off all lights",
  "lights.on": "Turn on all lights",
  "lights.to": "Set all lights brightness and/or color",
  // TV
  "tv.on": "Turn on the TV",
  "tv.off": "Turn off the TV (cant turn on without manual remote)",
  "tv.screen_on": "Turn on the TV screen",
  "tv.screen_off": "Turn off the TV screen",
  "tv.volume": "Set TV volume (0-100)",
  "tv.setup": "Setup TV local WebSocket connection",
  "tv.apps": "List available TV apps",
  "tv.open": "Open an app on TV",
  "tv.browse": "Open URL in TV browser",
  "tv.youtube": "Open YouTube video on TV",
  "tv.spotify": "Open Spotify on TV",
  "tv.movie_stream": "Stream movie on TV",
  "tv.anime_stream": "Stream anime on TV",
  // Laptop streaming
  "laptop.movie_stream": "Stream movie on laptop",
  "laptop.anime_stream": "Stream anime on laptop",
  // AC
  "ac.on": "Turn on air conditioning",
  "ac.off": "Turn off air conditioning",
  "ac.temp": "Set AC temperature",
  "ac.mode": "Set AC mode (cool/heat/fan/dry/auto)",
  "ac.fan": "Set AC fan speed",
  "ac.swing": "Set AC swing direction",
  "ac.devices": "List AC devices",
  "ac.auth": "Get Daikin auth URL",
  "ac.authorize": "Authorize with Daikin code",
  // AI
  "ai.translate": "Translate text to target language",
  "ai.code.command": "Generate terminal command from description",
  "ai.code.javascript": "Generate JavaScript code",
  "ai.code.typescript": "Generate TypeScript code",
  "ai.summarize": "Summarize long text",
  // Email
  "email.reply": "Generate email reply",
  "email.compose": "Compose professional email",
  // Messaging
  "slack.reply": "Generate Slack reply",
  "linkedin.reply": "Generate LinkedIn reply",
  // Job
  "job.question": "Answer job application question",
  "job.cover_letter": "Generate cover letter",
  // Downloads
  "download.movie": "Download movie torrent",
  "download.anime": "Download anime torrent",
  "download.subs": "Download subtitles for movie",
  // Media
  "media.end_streams": "Stop all active streams and downloads",
  // Utils
  "uuid.generate": "Generate random UUID",
  "transfer.start": "Start file transfer server",
  "spotify.play": "Play song on Spotify",
};
