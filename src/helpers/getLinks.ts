export const getPiratebaySearchLink = async (search: string) =>
  `https://thepiratebay.org/search.php?q=${search.split(" ").join("+")}+2&cat=0`;

export const getAnimeSearchLink = async (search: string) =>
  `https://nyaa.si/?f=0&c=1_2&q=${search.split(" ").join("+")}`;
