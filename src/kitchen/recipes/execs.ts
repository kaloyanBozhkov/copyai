import { CommandExecutor } from "../commandExecutor";
import { flattenObjectDot } from "../helpers";
import { v4 as uuidv4 } from "uuid";
import { exec } from "child_process";
import { getLLMResponse } from "@koko420/ai-tools";
import { getTranslationSystemMessage } from "../../ai/translations";
import z from "zod";
import { retry } from "@koko420/shared";
import { getEmailReplySystemMessage } from "../../ai/emails";
import { summarizeTextSystemMessage } from "../../ai/summaries";
import {
  JavaScriptSystemMessage,
  TypeScriptSystemMessage,
} from "../../ai/code";

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
  },
  translate: {
    // populated by setupLanguageTranslationCommands
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
