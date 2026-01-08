import { getLLMResponse } from "@koko420/ai-tools";
import { retry } from "@koko420/shared";
import z from "zod";
import { getFileSelectionSystemMessage } from "../../ai/commands";

const VIDEO_EXTENSIONS = [".mp4", ".mkv", ".avi", ".webm", ".mov", ".m4v"];
const SUBTITLE_EXTENSIONS = [".srt", ".sub", ".ass", ".ssa", ".vtt"];

interface TorrentFile {
  name: string;
  path: string;
  length: number;
  select: () => void;
  deselect: () => void;
}

const formatFileSize = (bytes: number): string => {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
};

const isVideoFile = (filename: string): boolean => {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return VIDEO_EXTENSIONS.includes(ext);
};

const isSubtitleFile = (filename: string): boolean => {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return SUBTITLE_EXTENSIONS.includes(ext);
};

export const selectTorrentFiles = async (
  torrentFiles: TorrentFile[],
  searchQuery: string
): Promise<{ videoFiles: TorrentFile[]; subtitleFiles: TorrentFile[] }> => {
  // Filter to only video files for AI selection
  const videoFiles = torrentFiles.filter((f) => isVideoFile(f.name));
  const subtitleFiles = torrentFiles.filter((f) => isSubtitleFile(f.name));

  // If only one video file, just return it
  if (videoFiles.length === 1) {
    return { videoFiles, subtitleFiles };
  }

  // If no video files found, fallback to largest file
  if (videoFiles.length === 0) {
    const largest = torrentFiles.reduce((a, b) =>
      a.length > b.length ? a : b
    );
    return { videoFiles: [largest], subtitleFiles };
  }

  // Prepare file list for AI
  const filesForAI = videoFiles.map((f, index) => ({
    index,
    name: f.name,
    size: formatFileSize(f.length),
  }));

  try {
    const { indexes } = await retry(
      async () => {
        return getLLMResponse({
          systemMessage: getFileSelectionSystemMessage(filesForAI),
          userMessage: searchQuery,
          schema: z.object({
            indexes: z
              .array(z.number())
              .describe("Array of file indexes to download"),
          }),
        });
      },
      3,
      false
    );

    const selectedVideos = indexes
      .filter((i) => i >= 0 && i < videoFiles.length)
      .map((i) => videoFiles[i]);

    console.log(
      "selectedVideos",
      selectedVideos.map((v) => v.name)
    );

    // If AI returned nothing valid, fallback to largest
    if (selectedVideos.length === 0) {
      const largest = videoFiles.reduce((a, b) =>
        a.length > b.length ? a : b
      );
      return { videoFiles: [largest], subtitleFiles };
    }

    return { videoFiles: selectedVideos, subtitleFiles };
  } catch (error) {
    console.error("AI file selection failed, using largest file:", error);
    const largest = videoFiles.reduce((a, b) => (a.length > b.length ? a : b));
    return { videoFiles: [largest], subtitleFiles };
  }
};

export const applyFileSelection = async (
  torrentFiles: any[],
  searchQuery: string,
  options: { prioritize?: boolean } = {}
): Promise<any> => {
  const { videoFiles, subtitleFiles } = await selectTorrentFiles(
    torrentFiles,
    searchQuery
  );

  const videoNames = new Set(videoFiles.map((f) => f.name));
  const subtitleNames = new Set(subtitleFiles.map((f) => f.name));

  // Deselect all, then select matched files using original torrent.files refs
  torrentFiles.forEach((file: any) => {
    file.deselect();
    if (videoNames.has(file.name)) {
      options.prioritize ? file.select(0) : file.select();
    } else if (subtitleNames.has(file.name)) {
      file.select();
    }
  });

  // Return primary movie file from original refs
  return torrentFiles.find((f: any) => f.name === videoFiles[0]?.name);
};
