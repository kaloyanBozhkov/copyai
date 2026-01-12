import fs from "fs";

/**
 * Convert SRT subtitle format to WebVTT format
 */
export const convertSrtToVtt = (srtContent: string): string => {
  // Start with WebVTT header
  let vttContent = "WEBVTT\n\n";

  // Replace SRT timestamps (00:00:00,000) with VTT format (00:00:00.000)
  const convertedTimestamps = srtContent.replace(
    /(\d{2}:\d{2}:\d{2}),(\d{3})/g,
    "$1.$2"
  );

  // Remove subtitle numbers (first line of each subtitle block)
  vttContent += convertedTimestamps.replace(/^\d+\s*$/gm, "").trim();

  return vttContent;
};

/**
 * Read SRT file and convert to WebVTT
 */
export const convertSrtFileToVtt = (srtFilePath: string): string => {
  const srtContent = fs.readFileSync(srtFilePath, "utf-8");
  return convertSrtToVtt(srtContent);
};

/**
 * Detect language from subtitle filename
 */
export const detectSubtitleLanguage = (filename: string): string => {
  const lowerName = filename.toLowerCase();

  // Check for language patterns in filename
  if (
    lowerName.includes(".eng.") ||
    lowerName.includes(".english.") ||
    lowerName.includes("-eng.")
  ) {
    return "en";
  } else if (
    lowerName.includes(".bul.") ||
    lowerName.includes(".bulgarian.") ||
    lowerName.includes("-bul.")
  ) {
    return "bg";
  } else if (
    lowerName.includes(".ita.") ||
    lowerName.includes(".italian.") ||
    lowerName.includes("-ita.")
  ) {
    return "it";
  }

  // Try standard pattern like .en.srt
  const match = filename.match(/\.([a-z]{2,3})\.srt$/i);
  if (match) return match[1];

  // Default to English
  return "en";
};

/**
 * Get human-readable language label
 */
export const getLanguageLabel = (languageCode: string): string => {
  const labels: Record<string, string> = {
    en: "English",
    bg: "Bulgarian",
    it: "Italian",
  };

  return labels[languageCode] ?? languageCode.toUpperCase();
};

export interface SubtitleInfo {
  filename: string;
  url: string;
  language: string;
  label: string;
}

/**
 * Scan directory for subtitle files and return metadata
 */
export const getSubtitlesFromDirectory = (
  dirPath: string,
  urlPrefix = "/subtitles/"
): SubtitleInfo[] => {
  try {
    const files = fs.readdirSync(dirPath);
    return files
      .filter((f) => f.endsWith(".srt"))
      .map((f) => {
        const language = detectSubtitleLanguage(f);
        return {
          filename: f,
          url: `${urlPrefix}${encodeURIComponent(f)}`,
          language: language,
          label: getLanguageLabel(language),
        };
      });
  } catch (err) {
    console.error("Error reading subtitle directory:", err);
    return [];
  }
};

