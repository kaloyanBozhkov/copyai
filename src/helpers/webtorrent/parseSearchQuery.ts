interface ParsedSearchQuery {
  title: string;
  season: number | null;
  episode: number | null;
  searchText: string; // title + season for torrent search
}

export const parseSearchQuery = (query: string, isAnimeSearch = false): ParsedSearchQuery => {
  const lower = query.toLowerCase();

  let season: number | null = null;
  let episode: number | null = null;

  // Match various season patterns: s01, s1, season 1, season01 (up to 4 digits)
  const seasonMatch = lower.match(/(?:s|season\s*)(\d{1,4})/);
  if (seasonMatch) {
    season = parseInt(seasonMatch[1], 10);
  }

  // Match various episode patterns: e01, e1, episode 1, episode01, ep1, ep01 (up to 4 digits)
  const episodeMatch = lower.match(/(?:e|ep|episode\s*)(\d{1,4})/);
  if (episodeMatch) {
    episode = parseInt(episodeMatch[1], 10);
  }

  // Remove season/episode patterns to get clean title (up to 4 digits)
  let title = lower
    .replace(/\s*(?:s|season\s*)\d{1,4}/gi, "")
    .replace(/\s*(?:e|ep|episode\s*)\d{1,4}/gi, "")
    .trim();

  // Build search text: title + season (for torrent site search)
  let searchText = title;
  if (season !== null && !isAnimeSearch) {
    searchText += ` s${season.toString().padStart(2, "0")}`;
  }

  return { title, season, episode, searchText };
};

