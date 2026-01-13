import path from "path";
import fs from "fs";
import os from "os";
import puppeteer from "puppeteer";
import { createExtractorFromData } from "node-unrar-js";
import AdmZip from "adm-zip";
import { retry } from "@koko420/shared";
import { getLLMResponse } from "@koko420/ai-tools";
import z from "zod";
import { parseSearchQuery } from "../webtorrent/parseSearchQuery";

const OPENSUBTITLES_BASE_URL = "https://www.opensubtitles.org";

export type SupportedLanguage = "eng" | "bul" | "ita";
export const isSupportedLanguage = (
  language: string
): language is SupportedLanguage => {
  return Object.values(LANGUAGE_CODES).includes(language as SupportedLanguage);
};
export const LANGUAGE_CODES: Record<string, SupportedLanguage> = {
  en: "eng",
  english: "eng",
  bg: "bul",
  bulgarian: "bul",
  it: "ita",
  italian: "ita",
};

export interface SubtitleSearchResult {
  index: number;
  filename: string;
  downloadUrl: string;
}

export const buildSearchUrl = (
  movieName: string,
  languages: SupportedLanguage[] = ["eng"]
): string => {
  const encodedName = encodeURIComponent(movieName.toLowerCase());
  const langString = languages.join(",");
  return `${OPENSUBTITLES_BASE_URL}/en/search/sublanguageid-${langString}/moviename-${encodedName}`;
};

export const normalizeLanguages = (
  langs: string[] = ["eng"]
): SupportedLanguage[] => {
  return langs.map((l) => LANGUAGE_CODES[l.toLowerCase()] ?? "eng");
};

export const scrapeSubtitleResults = async (
  searchUrl: string
): Promise<SubtitleSearchResult[]> => {
  console.log("Scraping subtitles from:", searchUrl);

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });

    // Get all table rows
    const rows = await page.$$("#search_results tbody tr");
    const subtitles: SubtitleSearchResult[] = [];

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];

      const result = await page.evaluate((el) => {
        const cells = el.querySelectorAll("td");
        if (cells.length < 5) return null;

        // First column: filename
        const filenameCell = cells[0] as unknown as { innerText: string };
        const filename = (filenameCell?.innerText?.trim() ?? "")
          .split("Watch online")[0]
          .trim();

        // 5th column: download link
        const downloadCell = cells[4];
        const downloadLink = downloadCell?.querySelector("a[href]");
        const downloadUrl = downloadLink?.getAttribute("href") ?? "";

        if (!filename || !downloadUrl) return null;

        return {
          filename,
          downloadUrl: downloadUrl.startsWith("http")
            ? downloadUrl
            : `https://www.opensubtitles.org${downloadUrl}`,
        };
      }, row);

      if (result) {
        subtitles.push({ index, ...result });
      }
    }
    console.log("found ", subtitles.length, " subtitles");
    return subtitles;
  } finally {
    await browser.close();
  }
};

export const formatResultsForLLM = (
  results: SubtitleSearchResult[]
): string => {
  return JSON.stringify(
    results.reduce(
      (acc, r, idx) => {
        acc[idx] = r.filename;
        return acc;
      },
      {} as Record<number, string>
    )
  );
};

export const downloadAndExtractSubtitle = async (
  downloadUrl: string,
  destFolder: string
): Promise<string[]> => {
  // Ensure dest folder exists
  if (!fs.existsSync(destFolder)) {
    fs.mkdirSync(destFolder, { recursive: true });
  }

  console.log("Downloading subtitle archive via Puppeteer:", downloadUrl);

  const browser = await puppeteer.launch({ headless: true });
  let buffer: Buffer;

  try {
    const page = await browser.newPage();
    const domain = new URL(downloadUrl).origin;
    // Navigate to website URL first
    await page.goto(domain, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Use fetch inside page.evaluate to download the file as base64
    const base64Data = await page.evaluate(async (url: string) => {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise<string>((resolve) => {
        // @ts-ignore - FileReader available in browser context
        const reader = new FileReader();
        reader.onloadend = () =>
          resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(blob);
      });
    }, downloadUrl);

    buffer = Buffer.from(base64Data, "base64");
    console.log("Downloaded", buffer.length, "bytes");
  } finally {
    await browser.close();
  }

  const extractedFiles: string[] = [];

  // Check if it's a RAR file (starts with "Rar!")
  const isRar = buffer.slice(0, 4).toString() === "Rar!";
  // Check if it's a ZIP file (starts with "PK")
  const isZip = buffer.slice(0, 2).toString() === "PK";

  if (isRar) {
    console.log("Extracting RAR archive with node-unrar-js...");
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer;
    const extractor = await createExtractorFromData({ data: arrayBuffer });
    const extracted = extractor.extract();

    for (const file of extracted.files) {
      if (file.fileHeader.flags.directory) continue;

      // Extract only .srt files, flatten to top level (ignore folder structure)
      const fileName = path.basename(file.fileHeader.name);
      if (!fileName.endsWith(".srt")) continue;

      const destPath = path.join(destFolder, fileName);

      if (file.extraction) {
        fs.writeFileSync(destPath, file.extraction);
        extractedFiles.push(destPath);
        console.log(`Extracted: ${fileName}`);
      }
    }
  } else if (isZip) {
    console.log("Extracting ZIP archive with adm-zip...");
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();

    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;

      // Extract only .srt files, flatten to top level (ignore folder structure)
      const fileName = path.basename(entry.entryName);
      if (!fileName.endsWith(".srt")) continue;

      const destPath = path.join(destFolder, fileName);

      // Extract buffer directly to avoid maintaining folder structure
      const entryData = entry.getData();
      fs.writeFileSync(destPath, entryData);
      extractedFiles.push(destPath);
      console.log(`Extracted: ${fileName}`);
    }
  } else {
    // Assume it's a plain .srt file
    console.log("File is not RAR or ZIP, saving directly...");
    const destPath = path.join(destFolder, `subtitle_${Date.now()}.srt`);
    fs.writeFileSync(destPath, buffer);
    extractedFiles.push(destPath);
  }

  console.log("Extracted subtitle files:", extractedFiles);
  return extractedFiles;
};

export const getSubsDirectory = () => {
  const subsDir = path.join(os.homedir(), "Downloads", "movies", "subs");
  if (!fs.existsSync(subsDir)) {
    fs.mkdirSync(subsDir, { recursive: true });
  }
  return subsDir;
};

export const subtitleExists = (subtitlePath: string): boolean => {
  return fs.existsSync(subtitlePath);
};

// Movie search result for movie ID-based search
interface MovieSearchResult {
  index: number;
  name: string;
  movieId: string;
}

/**
 * Scrape movie/show results from search2 page
 */
export const scrapeMovieResults = async (
  searchUrl: string
): Promise<MovieSearchResult[]> => {
  console.log("Scraping movie results from:", searchUrl);

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });

    // Find all tr elements where id starts with "name"
    const rows = await page.$$("tr[id^='name']");
    const movies: MovieSearchResult[] = [];

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];

      const result = await page.evaluate((el) => {
        // Find the strong > a tag within this tr
        const strongTag = el.querySelector("strong");
        if (!strongTag) return null;

        const link = strongTag.querySelector("a[href]");
        if (!link) return null;

        const name = link.innerText?.trim() ?? "";
        const href = link.getAttribute("href") ?? "";

        // Extract movie ID from href like /en/search/sublanguageid-eng/idmovie-1127294
        const movieIdMatch = href.match(/idmovie-(\d+)/);
        const movieId = movieIdMatch ? movieIdMatch[1] : "";

        if (!name || !movieId) return null;

        return { name, movieId };
      }, row);

      if (result) {
        movies.push({ index, ...result });
      }
    }

    console.log("Found", movies.length, "movie results");
    return movies;
  } finally {
    await browser.close();
  }
};

/**
 * Scrape episode results for a specific movie ID
 * First checks if it's a TV series, then follows the series link to scrape episodes
 */
export const scrapeEpisodeResults = async (
  movieId: string,
  season: number,
  episode: number,
  languages: SupportedLanguage[] = ["eng"]
): Promise<SubtitleSearchResult | null> => {
  const langString = languages.join(",");

  // Step 1: First visit the initial search URL to check if it's a TV series
  const initialSearchUrl = `${OPENSUBTITLES_BASE_URL}/en/search/sublanguageid-${langString}/idmovie-${movieId}`;
  console.log("Checking if TV series at:", initialSearchUrl);

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(initialSearchUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Step 2: Check if "All subtitles for this TV Series" link exists
    const tvSeriesLink = await page.evaluate(() => {
      // @ts-ignore - document is available in browser context
      const links = Array.from(document.querySelectorAll("a"));
      const tvLink = links.find((a) =>
        (a as any).textContent?.includes("All subtitles for this TV Series")
      );
      return tvLink ? (tvLink as any).getAttribute("href") : null;
    });

    // If no TV series link found, it's a movie
    if (!tvSeriesLink) {
      console.log("Not a TV series (movie detected), skipping episode search");
      return null;
    }

    // Step 3: Follow the TV series link
    const tvSeriesUrl = tvSeriesLink.startsWith("http")
      ? tvSeriesLink
      : `${OPENSUBTITLES_BASE_URL}${tvSeriesLink}`;
    console.log("Following TV series link:", tvSeriesUrl);
    await page.goto(tvSeriesUrl, { waitUntil: "networkidle2", timeout: 30000 });

    // Step 4: Scrape the episodes table
    const rows = await page.$$("#search_results tbody tr");
    let currentSeason: number | null = null;

    for (const row of rows) {
      const result = await page.evaluate(
        (el, targetSeason, targetEpisode) => {
          // Check if this is a season header row
          const seasonSpan = el.querySelector("span[id^='season-']");
          if (seasonSpan) {
            const seasonMatch = seasonSpan.id.match(/season-(\d+)/);
            return {
              isSeason: true,
              season: seasonMatch ? parseInt(seasonMatch[1]) : null,
            };
          }

          // Check if this is an episode row
          const hasEpisodeAttr =
            el.hasAttribute("itemprop") &&
            el.getAttribute("itemprop") === "episode";
          if (!hasEpisodeAttr) return null;

          const cells = el.querySelectorAll("td");
          if (cells.length < 3) return null;

          // First cell contains episode number
          const episodeSpan = cells[0].querySelector(
            "span[itemprop='episodeNumber']"
          );
          const episodeNum = episodeSpan
            ? parseInt(episodeSpan.textContent || "0")
            : 0;

          // Third cell contains download link
          const downloadCell = cells[2];
          const downloadLink = downloadCell?.querySelector("a[href]");
          const downloadUrl = downloadLink?.getAttribute("href") ?? "";

          // Get episode name for filename
          const nameSpan = cells[0].querySelector("span[itemprop='name']");
          const episodeName =
            nameSpan?.textContent?.trim() ?? `Episode ${episodeNum}`;

          if (episodeNum === targetEpisode && downloadUrl) {
            return {
              isSeason: false,
              episodeNum,
              episodeName,
              downloadUrl: downloadUrl.startsWith("http")
                ? downloadUrl
                : `https://www.opensubtitles.org${downloadUrl}`,
            };
          }

          return null;
        },
        row,
        season,
        episode
      );

      if (result && result.isSeason) {
        currentSeason = result.season ?? null;
      } else if (result && !result.isSeason && currentSeason === season) {
        // Found the matching episode in the correct season
        return {
          index: 0,
          filename: `S${season.toString().padStart(2, "0")}E${episode.toString().padStart(2, "0")} ${result.episodeName}`,
          downloadUrl: result.downloadUrl,
        };
      }
    }

    console.log(`No match found for Season ${season} Episode ${episode}`);
    return null;
  } finally {
    await browser.close();
  }
};

/**
 * Search subtitles using movie ID-based search (better for TV shows with season/episode)
 */
export const searchSubtitlesByMovieId = async (
  movieName: {
    title: string;
    season: number;
    episode: number;
    fileName?: string;
    originalTitle?: string; // Original clean title from search query
  },
  options: { languages?: string[] } = {}
): Promise<SubtitleSearchResult[]> => {
  const langs = normalizeLanguages(options.languages);
  const langString = langs.join(",");

  // Use originalTitle for search if provided, otherwise use title
  const searchTitle = movieName.originalTitle || movieName.title;

  // Step 1: Search for the movie/show using clean title
  const searchUrl = `${OPENSUBTITLES_BASE_URL}/en/search2/moviename-${encodeURIComponent(searchTitle)}/sublanguageid-${langString}`;
  const movieResults = await scrapeMovieResults(searchUrl);

  if (movieResults.length === 0) {
    console.log("No movie results found");
    return [];
  }

  // Step 2: Use AI to pick the right movie/show
  console.log("Asking AI to pick movie from", movieResults.length, "results");
  const formattedMovies = movieResults
    .map((m) => `[${m.index}] ${m.name}`)
    .join("\n");

  // Use originalTitle for AI selection if available (clean search query title)
  const searchTitleForAI = movieName.originalTitle || movieName.title;

  const { index } = await retry(
    async () => {
      return getLLMResponse({
        systemMessage: `<about>You are a movie/show selector.</about>
<instructions>
- You receive a list of movie/show names
- Choose the one that best matches the search query provided by user.
- Ignore season and episode numbers, focus on the title match
- Return the index of the best match
</instructions>

<result_items>
${formattedMovies}
</result_items>

<important>
- Respond with ONLY the index { index: number }
- If no good match, return { index: -1 }
</important>`,
        userMessage: `Search query: ${searchTitleForAI}${movieName.fileName ? `\file name: ${movieName.fileName}` : ""}`,
        schema: z.object({ index: z.number() }),
      });
    },
    2,
    false
  );

  if (index === -1 || index >= movieResults.length) {
    console.log("AI couldn't find suitable movie");
    return [];
  }

  const selectedMovie = movieResults[index];
  console.log(
    `AI selected movie: [${index}] ${selectedMovie.name} (ID: ${selectedMovie.movieId})`
  );

  // Step 3: Get the specific episode
  const episodeResult = await scrapeEpisodeResults(
    selectedMovie.movieId,
    movieName.season,
    movieName.episode,
    langs
  );

  if (!episodeResult) {
    return [];
  }

  return [episodeResult];
};

/**
 * Search subtitles using filename-based search (original method, better for movies)
 */
export const searchSubtitles2 = async (
  movieName: { title: string; season?: number | null; episode?: number | null },
  options: { languages?: string[] } = {}
): Promise<SubtitleSearchResult[]> => {
  const langs = normalizeLanguages(options.languages);
  const searchQuery = `${movieName.title} ${movieName.season ? `season ${movieName.season}` : ""} ${movieName.episode ? `episode ${movieName.episode}` : ""}`;
  const searchUrl = buildSearchUrl(searchQuery, langs);
  return scrapeSubtitleResults(searchUrl);
};

/**
 * Main search function that chooses the appropriate search method
 */
export const searchSubtitles = async (
  movieName: {
    title: string;
    season?: number | null;
    episode?: number | null;
    fileName?: string;
    originalTitle?: string; // Original clean title from search query
  },
  options: { languages?: string[] } = {}
): Promise<SubtitleSearchResult[]> => {
  // If we have season AND episode, use movie ID-based search first
  if (movieName.season && movieName.episode) {
    console.log("Using movie ID-based search (has season + episode)");
    const results = await searchSubtitlesByMovieId(
      {
        title: movieName.title,
        season: movieName.season as number,
        episode: movieName.episode as number,
        fileName: movieName.fileName,
        originalTitle: movieName.originalTitle,
      },
      options
    );
    if (results.length > 0) return results;

    // Fallback to filename-based search
    console.log("Movie ID search failed, falling back to filename search");
  } else {
    console.log("Using filename-based search (no season/episode or movie)");
  }

  return searchSubtitles2(movieName, options);
};

/**
 * Parse anime search query to extract title, season, and episode
 * Handles cases like "One Piece 1145" or "One Punch Man S1 E2"
 */
const parseAnimeSearchQuery = (
  searchQuery: string
): { title: string; season: number; episode: number } => {
  // First pass: use parseSearchQuery
  const parsed = parseSearchQuery(searchQuery, true);

  let title = parsed.title;
  let season = parsed.season ?? 1; // Default season to 1
  let episode = parsed.episode;

  // Second pass: if no episode found, check if title ends with digits
  // This handles cases like "One Piece 1145"
  if (!episode) {
    const titleWithEpisodeMatch = title.match(/^(.+?)\s+(\d{1,4})$/);
    if (titleWithEpisodeMatch) {
      title = titleWithEpisodeMatch[1].trim();
      episode = parseInt(titleWithEpisodeMatch[2], 10);
    }
  }

  return {
    title: title.trim(),
    season,
    episode: episode ?? 1,
  };
};

/**
 * Download anime subtitles from OpenSubtitles
 * Specifically designed for anime where we need to search by show name and then episode
 */
export const downloadAnimeSubs = async (
  searchQuery: string,
  options: {
    fileName?: string;
    destFolder: string;
    languages?: SupportedLanguage[];
  }
): Promise<
  | { success: true; paths: string[]; alreadyExists: boolean }
  | { success: false; error: string }
> => {
  const languages = options.languages ?? ["eng"];
  const langString = languages.join(",");

  // Parse the search query
  const { title, season, episode } = parseAnimeSearchQuery(searchQuery);
  console.log(
    `Parsed anime query: title="${title}", season=${season}, episode=${episode}`
  );

  // Step 1: Search for the show using clean title
  const searchTitle = title.toLowerCase().trim();
  const searchUrl = `${OPENSUBTITLES_BASE_URL}/en/search2/moviename-${encodeURIComponent(searchTitle)}/sublanguageid-${langString}`;

  console.log("Searching for anime show:", searchUrl);

  let movieResults: MovieSearchResult[];
  try {
    movieResults = await scrapeMovieResults(searchUrl);
  } catch (error) {
    console.error("Failed to scrape movie results:", error);
    return { success: false, error: "Failed to search for anime show" };
  }

  if (movieResults.length === 0) {
    console.log("No anime show results found");
    return { success: false, error: "No anime show found" };
  }

  // Step 2: Use AI to pick the right show (not episode)
  console.log(
    "Asking AI to pick anime show from",
    movieResults.length,
    "results"
  );
  const formattedMovies = movieResults
    .map((m) => `[${m.index}] ${m.name}`)
    .join("\n");

  let selectedIndex: number;
  try {
    const { index } = await retry(
      async () => {
        return getLLMResponse({
          systemMessage: `<about>You are an anime show selector.</about>
<instructions>
- You receive a list of anime show names
- Choose the one that best matches the search query provided by user
- Prefer the main show entry, not specific episodes or movies
- Ignore season and episode numbers, focus on the title match
- Return the index of the best match
</instructions>

<result_items>
${formattedMovies}
</result_items>

<important>
- Respond with ONLY the index { index: number }
- If no good match, return { index: -1 }
</important>`,
          userMessage: `Search query: ${title}`,
          schema: z.object({ index: z.number() }),
        });
      },
      2,
      false
    );
    selectedIndex = index;
  } catch (error) {
    console.error("AI selection failed:", error);
    return { success: false, error: "Failed to select anime show" };
  }

  if (selectedIndex === -1 || selectedIndex >= movieResults.length) {
    console.log("AI couldn't find suitable anime show");
    return { success: false, error: "No suitable anime show found" };
  }

  const selectedMovie = movieResults[selectedIndex];
  console.log(
    `Selected anime show: ${selectedMovie.name} (ID: ${selectedMovie.movieId})`
  );

  // Step 3: Visit the show page and scrape episodes
  const showPageUrl = `${OPENSUBTITLES_BASE_URL}/en/search/sublanguageid-${langString}/idmovie-${selectedMovie.movieId}`;
  console.log("Visiting show page:", showPageUrl);

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(showPageUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Step 4: Scrape the episodes table
    const rows = await page.$$("#search_results tbody tr");
    let currentSeason: number | null = null;

    for (const row of rows) {
      const result = await page.evaluate(
        (el, targetSeason, targetEpisode) => {
          // Check if this is a season header row
          const seasonSpan = el.querySelector("span[id^='season-']");
          if (seasonSpan) {
            const seasonMatch = seasonSpan.id.match(/season-(\d+)/);
            return {
              isSeason: true,
              season: seasonMatch ? parseInt(seasonMatch[1]) : null,
            };
          }

          // Check if this is an episode row
          const hasEpisodeAttr =
            el.hasAttribute("itemprop") &&
            el.getAttribute("itemprop") === "episode";
          if (!hasEpisodeAttr) return null;

          const cells = el.querySelectorAll("td");
          if (cells.length < 3) return null;

          // First cell contains episode number
          const episodeSpan = cells[0].querySelector(
            "span[itemprop='episodeNumber']"
          );
          const episodeNum = episodeSpan
            ? parseInt(episodeSpan.textContent || "0")
            : 0;

          // Third cell contains download link
          const downloadCell = cells[2];
          const downloadLink = downloadCell?.querySelector("a[href]");
          const downloadUrl = downloadLink?.getAttribute("href") ?? "";

          // Get episode name for filename
          const nameSpan = cells[0].querySelector("span[itemprop='name']");
          const episodeName =
            nameSpan?.textContent?.trim() ?? `Episode ${episodeNum}`;

          if (episodeNum === targetEpisode && downloadUrl) {
            return {
              isSeason: false,
              episodeNum,
              episodeName,
              downloadUrl: downloadUrl.startsWith("http")
                ? downloadUrl
                : `https://www.opensubtitles.org${downloadUrl}`,
            };
          }

          return null;
        },
        row,
        season,
        episode
      );

      if (result && result.isSeason) {
        currentSeason = result.season ?? null;
      } else if (result && !result.isSeason && currentSeason === season) {
        // Found the matching episode in the correct season
        await browser.close();

        const subtitle: SubtitleSearchResult = {
          index: 0,
          filename: `S${season.toString().padStart(2, "0")}E${episode >= 100 ? episode : episode.toString().padStart(2, "0")} ${result.episodeName}`,
          downloadUrl: result.downloadUrl,
        };

        console.log(`Found episode subtitle: ${subtitle.filename}`);

        // Download and extract the subtitle
        try {
          const extractedFiles = await downloadAndExtractSubtitle(
            subtitle.downloadUrl,
            options.destFolder
          );

          if (extractedFiles.length > 0) {
            return {
              success: true,
              paths: extractedFiles,
              alreadyExists: false,
            };
          } else {
            return {
              success: false,
              error: "No subtitle files extracted",
            };
          }
        } catch (error) {
          console.error("Failed to download subtitle:", error);
          return {
            success: false,
            error: "Failed to download subtitle",
          };
        }
      }
    }

    await browser.close();
    return {
      success: false,
      error: `Episode S${season}E${episode} not found`,
    };
  } catch (error) {
    await browser.close();
    console.error("Failed to scrape episode:", error);
    return { success: false, error: "Failed to scrape episode" };
  }
};
