import path from "path";
import fs from "fs";
import os from "os";
import puppeteer from "puppeteer";
import { createExtractorFromData } from "node-unrar-js";

const OPENSUBTITLES_BASE_URL = "https://www.opensubtitles.org";

type SupportedLanguage = "eng" | "bul" | "ita";

const LANGUAGE_CODES: Record<string, SupportedLanguage> = {
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
        const filename = (filenameCell?.innerText?.trim() ?? "").split('Watch online')[0].trim();

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

    // Set download behavior to use buffer
    const client = await page.createCDPSession();
    await client.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: destFolder,
    });

    // Navigate to download URL
    const response = await page.goto(downloadUrl, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    if (!response) {
      throw new Error("Failed to navigate to download URL");
    }

    // Wait a bit for download to initiate
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Find the downloaded file
    const files = fs.readdirSync(destFolder);
    const downloadedFile = files.find(
      (f) => f.endsWith(".rar") || f.endsWith(".srt") || f.endsWith(".zip")
    );

    if (!downloadedFile) {
      // If no file was downloaded via browser download, try getting response buffer
      const responseBuffer = await response.buffer();
      buffer = responseBuffer;
    } else {
      const downloadedPath = path.join(destFolder, downloadedFile);
      buffer = fs.readFileSync(downloadedPath);
      // Clean up the downloaded file
      fs.unlinkSync(downloadedPath);
    }
  } finally {
    await browser.close();
  }

  const extractedFiles: string[] = [];

  // Check if it's a RAR file (starts with "Rar!")
  const isRar = buffer.slice(0, 4).toString() === "Rar!";

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

      const fileName = path.basename(file.fileHeader.name);
      const destPath = path.join(destFolder, fileName);

      if (file.extraction) {
        fs.writeFileSync(destPath, file.extraction);
        if (fileName.endsWith(".srt")) {
          extractedFiles.push(destPath);
        }
        console.log(`Extracted: ${fileName}`);
      }
    }
  } else {
    // Assume it's a plain .srt file
    console.log("File is not RAR, saving directly...");
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

export const getSubtitlePath = (movieTitle: string, language = "en") => {
  const sanitized = movieTitle.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  return path.join(getSubsDirectory(), `${sanitized}.${language}.srt`);
};

export const subtitleExists = (subtitlePath: string): boolean => {
  return fs.existsSync(subtitlePath);
};

export const searchSubtitles = async (
  movieName: { title: string; season?: number | null; episode?: number | null },
  options: { languages?: string[] } = {}
): Promise<SubtitleSearchResult[]> => {
  const langs = normalizeLanguages(options.languages);
  const searchQuery = `${movieName.title} ${movieName.season ? `season ${movieName.season}` : ""} ${movieName.episode ? `episode ${movieName.episode}` : ""}`;
  const searchUrl = buildSearchUrl(searchQuery, langs);
  return scrapeSubtitleResults(searchUrl);
};
