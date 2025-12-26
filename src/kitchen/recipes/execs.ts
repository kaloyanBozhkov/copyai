import { CommandExecutor } from "../commandExecutor";
import { flattenObjectDot } from "../helpers";
import { v4 as uuidv4 } from "uuid";
import { exec } from "child_process";
import { getLLMResponse } from "@koko420/ai-tools";
import { getTranslationSystemMessage } from "../../ai/translations";
import z from "zod";
import { retry } from "@koko420/shared";
import {
  getCoverLetterSystemMessage,
  getEmailReplySystemMessage,
  getJobQuestionAnswerSystemMessage,
  getLinkedinReplySystemMessage,
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
import { streamMovie } from "../../helpers/webtorrent/streamMovie";

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
    email_reply: [
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
  reply: {
    linkedin: [
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
        if (!args || !args[0]) return "no movie title provided";
        const text = args.join(" ");
        if (!text) return "no movie title provided";

        const link = await getPiratebaySearchLink(text);
        const {
          elementsHTML: selectedItemsElementsHTML,
          text: selectedItemsHTML,
        } = await getPageHTMLWithJS({
          url: link,
          selector: "ol li",
          limit: 10,
          skip: 1,
          returnOuterHTML: true,
        });

        if (selectedItemsHTML.length === 0) {
          return "No torrents found for this movie";
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
          return `Invalid index ${index} returned. Available items: ${selectedItemsElementsHTML.length}`;
        }

        const magnetLink = parse(selectedItem).querySelector(
          'a[href^="magnet:?"]'
        );
        if (!magnetLink) return "no magnet link found";
        const magnetLinkUrl = magnetLink.getAttribute("href");
        if (!magnetLinkUrl) return "no magnet link URL found";

        // stream the torrent (non-blocking)
        const downloadPath = path.join(os.homedir(), "Downloads", "movies");

        streamMovie({ magnetLinkUrl, downloadPath });

        return `Stream started: ${magnetLinkUrl.split("&")[0].substring(0, 60)}...`;
      },
      "title: string",
    ],
    download: [
      async (args?: string[]) => {
        if (!args || !args[0]) return "no movie title provided";
        const text = args.join(" ");
        if (!text) return "no movie title provided";

        const link = await getPiratebaySearchLink(text);
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
          return "No torrents found for this movie";
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
          return `Invalid index ${index} returned. Available items: ${selectedItemsElementsHTML.length}`;
        }
        console.log("selectedItem", selectedItem.outerHTML);

        const magnetLink = parse(selectedItem).querySelector(
          'a[href^="magnet:?"]'
        );
        if (!magnetLink) return "no magnet link found";
        const magnetLinkUrl = magnetLink.getAttribute("href");
        if (!magnetLinkUrl) return "no magnet link URL found";

        // download the torrent (non-blocking)
        const downloadPath = path.join(os.homedir(), "Downloads", "movies");

        downloadMovie({ magnetLinkUrl, downloadPath });

        // Open Finder at downloads folder immediately
        exec(`open "${downloadPath}"`);

        return `Download started for: ${magnetLinkUrl.split("&")[0].substring(0, 60)}...`;
      },
      "title: string, year?: number",
    ],
  },
  anime: {
    stream: [
      async (args?: string[]) => {
        if (!args || !args[0]) return "no anime title provided";
        const text = args.join(" ");
        if (!text) return "no anime title provided";

        const link = await getAnimeSearchLink(text);
        const {
          elementsHTML: selectedItemsElementsHTML,
          text: selectedItemsHTML,
        } = await getPageHTMLWithJS({
          url: link,
          selector: "tbody tr",
          limit: 10,
          skip: 1,
          returnOuterHTML: true,
        });

        if (selectedItemsHTML.length === 0) {
          return "No torrents found for this anime";
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
        if (!selectedItem) {
          return `Invalid index ${index} returned. Available items: ${selectedItemsElementsHTML.length}`;
        }

        const magnetLink = parse(selectedItem).querySelector(
          'a[href^="magnet:?"]'
        );
        if (!magnetLink) return "no magnet link found";
        const magnetLinkUrl = magnetLink.getAttribute("href");
        if (!magnetLinkUrl) return "no magnet link URL found";

        // stream the torrent (non-blocking)
        const downloadPath = path.join(os.homedir(), "Downloads", "anime");

        streamMovie({ magnetLinkUrl, downloadPath });

        return `Stream started: ${magnetLinkUrl.split("&")[0].substring(0, 60)}...`;
      },
      "title: string",
    ],
    download: [
      async (args?: string[]) => {
        if (!args || !args[0]) return "no anime title provided";
        const text = args.join(" ");
        if (!text) return "no anime title provided";

        const link = await getAnimeSearchLink(text);
        const {
          elementsHTML: selectedItemsElementsHTML,
          text: selectedItemsHTML,
        } = await getPageHTMLWithJS({
          url: link,
          selector: "tbody tr",
          limit: 10, // 10 <li>'s
          skip: 1, // skip from the Nth <li>
          returnOuterHTML: true,
        });

        if (selectedItemsHTML.length === 0) {
          return "No torrents found for this movie";
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
        if (!selectedItem) {
          return `Invalid index ${index} returned. Available items: ${selectedItemsElementsHTML.length}`;
        }
        console.log("selectedItem", selectedItem.outerHTML);

        const magnetLink = parse(selectedItem).querySelector(
          'a[href^="magnet:?"]'
        );
        if (!magnetLink) return "no magnet link found";
        const magnetLinkUrl = magnetLink.getAttribute("href");
        if (!magnetLinkUrl) return "no magnet link URL found";

        // download the torrent (non-blocking)
        const downloadPath = path.join(os.homedir(), "Downloads", "movies");

        downloadMovie({ magnetLinkUrl, downloadPath });

        // Open Finder at downloads folder immediately
        exec(`open "${downloadPath}"`);

        return `Download started for: ${magnetLinkUrl.split("&")[0].substring(0, 60)}...`;
      },
      "title: string, S_E_: string",
    ],
  },
};

const setupLanguageTranslationCommands = () => {
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

export const execs = flattenObjectDot(execsPerCategory);
