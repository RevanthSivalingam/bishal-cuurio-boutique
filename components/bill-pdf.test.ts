import { describe, it, expect, vi, beforeEach } from "vitest";

describe("bill-pdf logo loading", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("fetches and base64-encodes the logo, then caches it", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => bytes.buffer,
    });
    vi.stubGlobal("fetch", fetchMock);

    const { loadLogoBase64, bufferToBase64 } = await import("./bill-pdf");
    const expected = bufferToBase64(bytes.buffer);

    const first = await loadLogoBase64();
    const second = await loadLogoBase64();

    expect(first).toBe(expected);
    expect(second).toBe(expected);
    expect(fetchMock).toHaveBeenCalledTimes(1); // second call hit the cache
  });

  it("throws a clear error when the logo fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 })
    );

    const { loadLogoBase64 } = await import("./bill-pdf");

    await expect(loadLogoBase64()).rejects.toThrow(
      "Failed to load PDF logo: 404"
    );
  });
});
