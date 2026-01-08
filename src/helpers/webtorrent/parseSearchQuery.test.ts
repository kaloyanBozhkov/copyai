import { describe, it, expect } from "vitest";
import { parseSearchQuery } from "./parseSearchQuery";

describe("parseSearchQuery", () => {
  describe("season parsing", () => {
    it("parses s01 format", () => {
      const result = parseSearchQuery("The Marvelous Mrs. Maisel s01");
      expect(result.season).toBe(1);
      expect(result.title).toBe("the marvelous mrs. maisel");
      expect(result.searchText).toBe("the marvelous mrs. maisel s01");
    });

    it("parses s1 format", () => {
      const result = parseSearchQuery("Breaking Bad s1");
      expect(result.season).toBe(1);
      expect(result.title).toBe("breaking bad");
    });

    it("parses season 1 format", () => {
      const result = parseSearchQuery("Game of Thrones season 1");
      expect(result.season).toBe(1);
      expect(result.title).toBe("game of thrones");
    });

    it("parses Season 1 format (uppercase)", () => {
      const result = parseSearchQuery("The Office Season 1");
      expect(result.season).toBe(1);
      expect(result.title).toBe("the office");
    });

    it("parses season01 format (no space)", () => {
      const result = parseSearchQuery("Friends season01");
      expect(result.season).toBe(1);
      expect(result.title).toBe("friends");
    });

    it("parses S12 (double digit)", () => {
      const result = parseSearchQuery("Supernatural S12");
      expect(result.season).toBe(12);
      expect(result.searchText).toBe("supernatural s12");
    });
  });

  describe("episode parsing", () => {
    it("parses e01 format", () => {
      const result = parseSearchQuery("Breaking Bad e01");
      expect(result.episode).toBe(1);
    });

    it("parses e1 format", () => {
      const result = parseSearchQuery("Breaking Bad e1");
      expect(result.episode).toBe(1);
    });

    it("parses episode 1 format", () => {
      const result = parseSearchQuery("Breaking Bad episode 1");
      expect(result.episode).toBe(1);
    });

    it("parses Episode 5 format (uppercase)", () => {
      const result = parseSearchQuery("Breaking Bad Episode 5");
      expect(result.episode).toBe(5);
    });

    it("parses ep1 format", () => {
      const result = parseSearchQuery("Breaking Bad ep1");
      expect(result.episode).toBe(1);
    });

    it("parses ep01 format", () => {
      const result = parseSearchQuery("Breaking Bad ep01");
      expect(result.episode).toBe(1);
    });

    it("parses E15 (double digit)", () => {
      const result = parseSearchQuery("Breaking Bad E15");
      expect(result.episode).toBe(15);
    });
  });

  describe("combined season and episode", () => {
    it("parses s01e01 format", () => {
      const result = parseSearchQuery("The Marvelous Mrs. Maisel s01e01");
      expect(result.season).toBe(1);
      expect(result.episode).toBe(1);
      expect(result.title).toBe("the marvelous mrs. maisel");
      expect(result.searchText).toBe("the marvelous mrs. maisel s01");
    });

    it("parses s1 e1 format (with space)", () => {
      const result = parseSearchQuery("Breaking Bad s1 e1");
      expect(result.season).toBe(1);
      expect(result.episode).toBe(1);
    });

    it("parses S01E05 format (uppercase)", () => {
      const result = parseSearchQuery("Game of Thrones S01E05");
      expect(result.season).toBe(1);
      expect(result.episode).toBe(5);
    });

    it("parses season 2 episode 10 format", () => {
      const result = parseSearchQuery("The Office season 2 episode 10");
      expect(result.season).toBe(2);
      expect(result.episode).toBe(10);
      expect(result.title).toBe("the office");
    });

    it("parses Season 3 Episode 7 format (uppercase)", () => {
      const result = parseSearchQuery("Friends Season 3 Episode 7");
      expect(result.season).toBe(3);
      expect(result.episode).toBe(7);
    });

    it("parses mixed format s02 episode 5", () => {
      const result = parseSearchQuery("Stranger Things s02 episode 5");
      expect(result.season).toBe(2);
      expect(result.episode).toBe(5);
    });
  });

  describe("movie (no season/episode)", () => {
    it("returns null for season and episode when not present", () => {
      const result = parseSearchQuery("Inception 2010");
      expect(result.season).toBeNull();
      expect(result.episode).toBeNull();
      expect(result.title).toBe("inception 2010");
      expect(result.searchText).toBe("inception 2010");
    });

    it("handles movie title only", () => {
      const result = parseSearchQuery("The Dark Knight");
      expect(result.season).toBeNull();
      expect(result.episode).toBeNull();
      expect(result.title).toBe("the dark knight");
    });
  });

  describe("edge cases", () => {
    it("handles extra whitespace", () => {
      const result = parseSearchQuery("  Breaking Bad   s01   e05  ");
      expect(result.season).toBe(1);
      expect(result.episode).toBe(5);
      expect(result.title).toBe("breaking bad");
    });

    it("handles title with numbers", () => {
      const result = parseSearchQuery("24 s01e01");
      expect(result.season).toBe(1);
      expect(result.episode).toBe(1);
      expect(result.title).toBe("24");
    });

    it("searchText includes padded season", () => {
      const result = parseSearchQuery("Lost s3");
      expect(result.searchText).toBe("lost s03");
    });

    it("searchText does not include episode", () => {
      const result = parseSearchQuery("Lost s03e10");
      expect(result.searchText).toBe("lost s03");
      expect(result.episode).toBe(10);
    });
  });
});

