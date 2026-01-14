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
  listRooms,
} from "../../helpers/wiz";
import {
  turnOnTV,
  turnOffTV,
  setTVVolume,
  setupTV,
  launchTVApp,
  listTVApps,
  openTVBrowser,
  openYouTube,
  openSpotify,
} from "../../helpers/lg";
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
import { playSpotify } from "../../helpers/spotify";

export const execsPerCategory: Record<
  string,
  Record<string, CommandExecutor>
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
      async (args?: string[]) => {
        if (!args || !args[0]) return null;
        const text = args.join(" ");
        const subsLanguage = (text.split(" -")[1] ?? "eng").trim();
        if (!isSupportedLanguage(subsLanguage)) {
          return `Invalid subtitle language: ${subsLanguage}`;
        }
        const title = text.split(" -")[0].trim();
        if (!title) return "no movie title provided";

        const { searchText } = parseSearchQuery(title);
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
              userMessage: title,
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

        const magnetLink = parse(selectedItem).querySelector(
          'a[href^="magnet:?"]'
        );
        if (!magnetLink) return null;
        const magnetLinkUrl = magnetLink.getAttribute("href");
        if (!magnetLinkUrl) return null;

        // stream the torrent (non-blocking)
        const downloadPath = path.join(os.homedir(), "Downloads", "movies");

        await streamMovie({
          magnetLinkUrl,
          downloadPath,
          searchQuery: title,
          subsLanguage,
        });

        return `Stream started: ${magnetLinkUrl.split("&")[0].substring(0, 60)}...`;
      },
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
      async (args?: string[]) => {
        if (!args || !args[0]) return null;
        const text = args.join(" ");
        const subsLanguage = (text.split(" -")[1] ?? "eng").trim();
        if (!isSupportedLanguage(subsLanguage)) {
          return `Invalid subtitle language: ${subsLanguage}`;
        }
        const title = text.split(" -")[0].trim();
        if (!title) return "no movie title provided";
        const { searchText, season, episode } = parseSearchQuery(title, true);
        console.log("searchText, season, episode", searchText, season, episode);

        // Helper to search pages
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
              `searching anime torrent page ${page}${withSeasonEpisode ? " (with S/E)" : ""}: ${link}`
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
                  userMessage: title,
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

        // First try with season/episode if present
        let magnetLinkUrl: string | null = null;
        if (season || episode) {
          magnetLinkUrl = await searchPages(true);
        }

        // Fallback to search without season/episode
        if (!magnetLinkUrl) {
          console.log("Falling back to search without season/episode...");
          magnetLinkUrl = await searchPages(false);
        }

        if (!magnetLinkUrl) return null;

        // stream the torrent (non-blocking)
        const downloadPath = path.join(os.homedir(), "Downloads", "movies");

        await streamMovie({
          magnetLinkUrl,
          downloadPath,
          searchQuery: title,
          subsLanguage,
          isAnime: true,
        });

        return `Stream started: ${magnetLinkUrl.split("&")[0].substring(0, 60)}...`;
      },
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
  transfer: {
    server: [async () => startTransferServer()],
  },
  spotify: {
    play: [
      async (args?: string[]) => {
        if (!args || args.length === 0) return "no keyword or song name provided";
        
        let keyword = "";
        let random = false;
        let trackIndex: number | undefined;
        
        // Parse arguments
        for (let i = 0; i < args.length; i++) {
          const arg = args[i];
          
          if (arg === "-random" || arg === "-r") {
            random = true;
          } else if ((arg === "-number" || arg === "-n") && i + 1 < args.length) {
            const num = parseInt(args[i + 1], 10);
            if (!isNaN(num)) {
              trackIndex = num;
              i++; // Skip next arg since we consumed it
            }
          } else {
            // It's part of the keyword/song name
            keyword += (keyword ? " " : "") + arg;
          }
        }
        
        if (!keyword) return "no keyword or song name provided";
        
        return playSpotify(keyword, random, trackIndex);
      },
      "keyword or song: string, -random|-r?: flag, -number|-n <index>?: number",
    ],
  },
  home: {
    lights_off: [async () => setAllLightsState(false)],
    lights_on: [async () => setAllLightsState(true)],
    room_off: [
      async (args?: string[]) => {
        if (!args || !args[0]) return "no room name provided";
        return setRoomLightsState(args.join(" "), false);
      },
      "room: string",
    ],
    room_on: [
      async (args?: string[]) => {
        if (!args || !args[0]) return "no room name provided";
        return setRoomLightsState(args.join(" "), true);
      },
      "room: string",
    ],
    list_rooms: [async () => listRooms()],
    tv_volume: [
      async (args?: string[]) => {
        const volume = parseInt(args?.[0] ?? "50", 10);
        if (isNaN(volume)) return "invalid volume number";
        return setTVVolume(volume);
      },
      "volume: number",
    ],
    tv_on: [async () => turnOnTV()],
    tv_off: [async () => turnOffTV()],
    tv_app: [
      async (args?: string[]) => {
        const appIdOrName = args?.[0];
        if (!appIdOrName) return "no app ID or name provided";
        return launchTVApp(appIdOrName);
      },
      "appId or appName: string",
    ],
    tv_list_apps: [async () => listTVApps()],
    tv_browser: [
      async (args?: string[]) => {
        const url = args?.[0];
        if (!url) return "no URL provided";
        return openTVBrowser(url);
      },
      "url: string",
    ],
    tv_youtube: [
      async (args?: string[]) => {
        if (!args || args.length === 0) return "no search query or video provided";
        const query = args.join(" ");
        return openYouTube(query);
      },
      "videoId or search: string",
    ],
    tv_spotify: [
      async (args?: string[]) => {
        if (!args || args.length === 0) return "no search query provided";
        const query = args.join(" ");
        return openSpotify(query);
      },
      "search: string",
    ],
    tv_setup: [
      async (args?: string[]) => {
        const force = args?.[0] === "force";
        return setupTV(force);
      },
      "force?: string",
    ],
    aircon_on: [
      async (args?: string[]) => {
        const room = args?.[0];
        return turnOnAC(room);
      },
      "room?: living room | office | bedroom",
    ],
    aircon_off: [
      async (args?: string[]) => {
        const room = args?.[0];
        return turnOffAC(room);
      },
      "room?: living room | office | bedroom",
    ],
    aircon_temp: [
      async (args?: string[]) => {
        if (!args || args.length === 0) return "no temperature provided";
        const lastArg = args[args.length - 1];
        const temp = parseInt(lastArg, 10);
        if (isNaN(temp)) return "invalid temperature";
        
        const room = args.length > 1 ? args.slice(0, -1).join(" ") : undefined;
        return setACTemp(room, temp);
      },
      "room?: string, temp: number (16-32°C)",
    ],
    aircon_mode: [
      async (args?: string[]) => {
        if (!args || args.length === 0) return "no mode provided";
        const lastArg = args[args.length - 1].toLowerCase();
        const validModes = ["cool", "heat", "auto", "dry", "fan"];
        
        if (!validModes.includes(lastArg)) {
          return `invalid mode. Use: ${validModes.join(", ")}`;
        }
        
        const room = args.length > 1 ? args.slice(0, -1).join(" ") : undefined;
        return setACMode(room, lastArg as any);
      },
      "room?: string, mode: cool | heat | auto | dry | fan",
    ],
    aircon_fan_rate: [
      async (args?: string[]) => {
        if (!args || args.length === 0) return "no fan rate provided";
        const lastArg = args[args.length - 1];
        const rate = parseInt(lastArg, 10);
        if (isNaN(rate) || rate < 1 || rate > 5) return "fan rate must be 1-5";
        
        const room = args.length > 1 ? args.slice(0, -1).join(" ") : undefined;
        return setACFanRate(room, rate);
      },
      "room?: string, rate: 1-5",
    ],
    aircon_fan_dir: [
      async (args?: string[]) => {
        if (!args || args.length === 0) return "no fan direction provided";
        const lastArg = args[args.length - 1];
        const dir = parseInt(lastArg, 10);
        if (isNaN(dir) || dir < 0 || dir > 5) return "fan direction must be 0-5";
        
        const room = args.length > 1 ? args.slice(0, -1).join(" ") : undefined;
        return setACFanDirection(room, dir);
      },
      "room?: string, direction: 0-5",
    ],
    aircon_list: [async () => listDevices()],
    aircon_authorize: [async () => getAuthUrl()],
    aircon_code: [
      async (args?: string[]) => {
        const code = args?.[0];
        if (!code) return "no authorization code provided";
        return authorizeWithCode(code);
      },
      "code: string",
    ],
  },
  development: {},
};

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
    return execsPerCategory.ai.translate[0]([language + " " + text]);
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

export const execs = flattenObjectDot(execsPerCategory);
