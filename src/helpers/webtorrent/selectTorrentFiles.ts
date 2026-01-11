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

  const allFilesToChooseFrom = [...videoFiles, ...subtitleFiles];

  // Prepare file list for AI
  const filesForAI = allFilesToChooseFrom.map((f, index) => ({
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

    const selectedFiles = indexes
      .filter((i) => i >= 0 && i < allFilesToChooseFrom.length)
      .map((i) => allFilesToChooseFrom[i]);

    // Separate back into video and subtitle files
    const selectedVideos = selectedFiles.filter((f) => isVideoFile(f.name));
    const selectedSubs = selectedFiles.filter((f) => isSubtitleFile(f.name));

    console.log(
      "AI selected files:",
      selectedFiles.map((v) => v.name)
    );

    // If AI returned nothing valid, fallback to largest and all subs
    if (selectedVideos.length === 0) {
      const largest = videoFiles.reduce((a, b) =>
        a.length > b.length ? a : b
      );
      return { videoFiles: [largest], subtitleFiles };
    }

    return { videoFiles: selectedVideos, subtitleFiles: selectedSubs };
  } catch (error) {
    console.error("AI file selection failed, using largest file:", error);
    const largest = videoFiles.reduce((a, b) => (a.length > b.length ? a : b));
    return { videoFiles: [largest], subtitleFiles };
  }
};

export const applyFileSelection = async (
  torrent: any,
  searchQuery: string,
  options: { prioritize?: boolean } = {}
): Promise<any> => {
  // deselect all https://github.com/webtorrent/webtorrent/pull/2757
  torrent.deselect(0, torrent.pieces.length - 1);

  const torrentFiles = torrent.files;

  const { videoFiles, subtitleFiles } = await selectTorrentFiles(
    torrentFiles,
    searchQuery
  );

  const videoNames = new Set(videoFiles.map((f) => f.name));
  const subtitleNames = new Set(subtitleFiles.map((f) => f.name));

  const selectedForDownload: string[] = [];

  // Select only matched files
  torrentFiles.forEach((file: any) => {
    if (videoNames.has(file.name) || subtitleNames.has(file.name)) {
      options.prioritize ? file.select(0) : file.select();
      selectedForDownload.push(file.name);
    }
  });

  console.log("Files selected for download:", selectedForDownload);

  // Return primary movie file from original refs
  return torrentFiles;
};
