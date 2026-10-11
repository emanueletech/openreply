import { describe, expect, it } from "vitest";
import {
  MetaApiError,
  PermissionError,
  RateLimitError,
  TokenExpiredError,
} from "../lib/meta/client";

/**
 * What Meta's error subclasses keep from the error body.
 *
 * Seen in production: a private reply refused with code=100 sub=2534025 was
 * retried three times, because PermissionError threw the subcode away and the
 * worker's "this will fail the same way again" check reads exactly that field.
 */
describe("Meta API error classes", () => {
  it("keeps the subcode the worker decides on", () => {
    expect(new PermissionError("m", "trace", 2534025).subcode).toBe(2534025);
    expect(new RateLimitError("m", "trace", 2207051).subcode).toBe(2207051);
    expect(new TokenExpiredError("m", "trace", 458).subcode).toBe(458);
  });

  it("keeps the code Meta sent, not the one the class is named after", () => {
    expect(new PermissionError("m", "trace", undefined, 200).code).toBe(200);
    expect(new RateLimitError("m", "trace", undefined, 4).code).toBe(4);
  });

  it("still defaults for a call site that passes neither", () => {
    expect(new PermissionError("m").code).toBe(100);
    expect(new RateLimitError("m").code).toBe(368);
    expect(new TokenExpiredError("m").code).toBe(190);
    expect(new PermissionError("m").subcode).toBeUndefined();
  });

  it("stays a MetaApiError, which is how the worker narrows it", () => {
    expect(new PermissionError("m", "t", 2534025)).toBeInstanceOf(MetaApiError);
  });
});
