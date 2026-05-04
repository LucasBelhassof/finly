import { describe, expect, it } from "vitest";

import { normalizeLimit, normalizePaginationParams, paginateCollection } from "./pagination.js";

describe("pagination helpers", () => {
  it("clamps invalid and oversized page params to safe defaults", () => {
    expect(normalizePaginationParams({ page: "0", pageSize: "999" })).toEqual({
      isPaginated: true,
      page: 1,
      pageSize: 200,
      offset: 0,
    });
    expect(normalizePaginationParams({ page: "-3", pageSize: "abc" })).toEqual({
      isPaginated: false,
      page: 1,
      pageSize: 50,
      offset: 0,
    });
  });

  it("clamps limit to the configured max and fallback", () => {
    expect(normalizeLimit(undefined, 8)).toBe(8);
    expect(normalizeLimit("999", 8)).toBe(200);
    expect(normalizeLimit("abc", 8)).toBe(8);
  });

  it("keeps legacy collections unchanged when pagination is not requested", () => {
    const result = paginateCollection([1, 2, 3], {
      isPaginated: false,
      page: 1,
      pageSize: 50,
      offset: 0,
    });

    expect(result).toEqual({
      items: [1, 2, 3],
      pagination: null,
    });
  });
});
