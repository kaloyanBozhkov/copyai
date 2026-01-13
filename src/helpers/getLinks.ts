export const getPiratebaySearchLink = async (search: string) =>
  `https://thepiratebay.org/search.php?q=${search.split(" ").join("+")}+2&cat=0`;

export const getAnimeSearchLink = async (
  search: string,
  season?: number,
  episode?: number
) => {
  let seasonEpisode = "";
  
  // Format episode: pad to 2 digits if < 100, otherwise use raw number
  const formatEpisode = (ep: number) => ep >= 100 ? ep.toString() : ep.toString().padStart(2, "0");
  const formatSeason = (s: number) => s.toString().padStart(2, "0");
  
  if (season && episode) {
    seasonEpisode = `+S${formatSeason(season)}E${formatEpisode(episode)}`;
  } else if (episode) {
    seasonEpisode = `+E${formatEpisode(episode)}`;
  } else if (season) {
    seasonEpisode = `+S${formatSeason(season)}`;
  }
  
  return `https://nyaa.si/?f=0&c=1_2&q=${search.split(" ").join("+")}${seasonEpisode}`;
};
