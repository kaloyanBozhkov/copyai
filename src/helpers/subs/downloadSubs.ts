import { getLLMResponse } from "@koko420/ai-tools";
import { retry } from "@koko420/shared";
import z from "zod";
import {
  searchSubtitles,
  formatResultsForLLM,
  downloadAndExtractSubtitle,
  getSubtitlePath,
  subtitleExists,
  getSubsDirectory,
  SubtitleSearchResult,
} from "./opensubtitles";
import { parseSearchQuery } from "../webtorrent/parseSearchQuery";

const getSubtitleSelectionSystemMessage = (subtitles: string) => {
  return `<about>You are a subtitle chooser.</about>
<instructions>
- You receive a list of subtitle search results Record<number, string> where number is an index and string is the subtitle file name, and a video file name being streamed
- Choose the subtitle that best matches the video file name provided by user (file name, quality, season, episode) and the initial user movie search query.
- Try to also match the release group, quality (720p, 1080p, etc), and source (BluRay, WEB-DL, etc) when possible
- The numeric key of the Record is what you need to return. E.g. { index: 0 } if matching the first item in the Record: { 0: "1080p.WEB-DL.DDP5.1.H.264-NTb.srt", ... }
 </instructions>

<result_items>
${subtitles}
</result_items>

<important>
- Respond with ONLY the matched numeric key of the Record, as such: { index: number }. No additional text or explanations.
- If no suitable subtitle found, return { index: -1 }
- The match is not case sensitive or exact, it can be a fuzzy match.
- For series, be sure to have checked season/episode via [S01E02] or S01 E02 or similar combinations
</important>

<match_examples>
- Video file name: "The.Big.Bang.Theory.S01E01.720p.WEB-DL.DDP5.1.H.264-NTb.mkv"
- Subtitle search results: { 0: "The Big Bang Theory Season 1 Episode 2", 1: "The Big Bang Theory Season 1 Episode 1", 2: "The Big Bang Theory Season 1 Episode 4", 3: "The Big Bang Theory [S0105]" }
- Return: { index: 1 }
</match_examples>
`;
};

export interface DownloadSubsResult {
  success: boolean;
  paths?: string[];
  error?: string;
  alreadyExists?: boolean;
}

export const downloadMovieSubs = async (
  searchQuery: string,
  options: {
    fileName?: string;
    languages?: string[];
    forceDownload?: boolean;
    destFolder?: string;
  } = {}
): Promise<DownloadSubsResult> => {
  const languages = options.languages ?? ["eng"];

  const { title, season, episode } = parseSearchQuery(searchQuery);
  console.log("Searching subtitles for:", title, "(from:", searchQuery, ")");

  // Check if subtitle already exists
  const destFolder = options.destFolder ?? getSubsDirectory();
  const subtitlePath = getSubtitlePath(title, languages[0]);

  if (!options.forceDownload && subtitleExists(subtitlePath)) {
    console.log(`Subtitle already exists: ${subtitlePath}`);
    return { success: true, paths: [subtitlePath], alreadyExists: true };
  }

  try {
    // Define search strategies with fallbacks
    const searchStrategies = [
      { title, season, episode, label: "title + season + episode" },
      ...(options.fileName
        ? [
            {
              ...parseSearchQuery(options.fileName),
              label: "fileName parsed",
            },
          ]
        : []),
      ...(season
        ? [{ title, season, episode: null, label: "title + season" }]
        : []),
      { title, season: null, episode: null, label: "title only" },
    ];

    let selectedSub: SubtitleSearchResult | null = null;

    // Try each search strategy until we find a suitable subtitle
    for (const strategy of searchStrategies) {
      console.log(`Trying search strategy: ${strategy.label}`);

      const results = await searchSubtitles(
        {
          title: strategy.title,
          season: strategy.season,
          episode: strategy.episode,
        },
        { languages }
      );

      if (results.length === 0) {
        console.log(`No results found for: ${strategy.label}`);
        continue;
      }

      console.info(
        `Found ${results.length} subtitle(s) for: ${strategy.label}`
      );

      // Format results for LLM
      const formattedResults = formatResultsForLLM(results);
      console.log("Formatted for LLM:\n", formattedResults);

      // Use LLM to select best subtitle
      const llmQuery = options.fileName ?? searchQuery;
      const { index } = await retry(
        async () => {
          return getLLMResponse({
            systemMessage: getSubtitleSelectionSystemMessage(formattedResults),
            userMessage: `Video file name: ${llmQuery}\nOriginal search query: ${searchQuery}\nParsed search query: ${title}${season ? ` season ${season}` : ""}${episode ? ` episode ${episode}` : ""}`,
            schema: z.object({
              index: z.number(),
            }),
          });
        },
        2,
        false
      );

      if (index === -1 || index >= results.length) {
        console.log(
          `AI couldn't find suitable subtitle for: ${strategy.label}`
        );
        continue;
      }

      // Found a suitable subtitle!
      selectedSub = results[index];
      console.log(
        `AI selected: [${index}] ${selectedSub.filename} (strategy: ${strategy.label})`
      );
      break;
    }

    if (!selectedSub) {
      return {
        success: false,
        error: "No suitable subtitle found after trying all search strategies",
      };
    }

    // Download and extract the selected subtitle
    const extractedPaths = await downloadAndExtractSubtitle(
      selectedSub.downloadUrl,
      destFolder
    );

    return { success: true, paths: extractedPaths };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to download subtitles:", errorMessage);
    return { success: false, error: errorMessage };
  }
};
