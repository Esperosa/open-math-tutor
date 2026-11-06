import { describe, expect, it } from "vitest";
import { chunkText, retrieveTopChunks, type TextChunk } from "./retrieval.js";

describe("chunkText", () => {
  it("splits long text into multiple overlapping chunks", () => {
    const words = Array.from({ length: 400 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkText("src1", "My notes", words, 180);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.sourceId).toBe("src1");
  });

  it("returns a single chunk for short text", () => {
    const chunks = chunkText("src1", "My notes", "short text here", 180);
    expect(chunks).toHaveLength(1);
  });

  it("returns no chunks for empty text", () => {
    expect(chunkText("src1", "My notes", "   ")).toHaveLength(0);
  });
});

describe("retrieveTopChunks", () => {
  const chunks: TextChunk[] = [
    { sourceId: "s1", sourceTitle: "Algebra notes", chunkIndex: 0, text: "Linear equations isolate the variable x by moving constants to the other side." },
    { sourceId: "s1", sourceTitle: "Algebra notes", chunkIndex: 1, text: "Fractions require a common denominator before adding or subtracting." },
    { sourceId: "s2", sourceTitle: "Geometry notes", chunkIndex: 0, text: "Triangles have interior angles summing to 180 degrees." },
  ];

  it("ranks the most relevant chunk highest", () => {
    const results = retrieveTopChunks(chunks, "how do I isolate the variable in a linear equation", 2);
    expect(results[0]?.sourceId).toBe("s1");
    expect(results[0]?.chunkIndex).toBe(0);
  });

  it("returns an empty array for an empty query or empty corpus", () => {
    expect(retrieveTopChunks(chunks, "")).toHaveLength(0);
    expect(retrieveTopChunks([], "fractions")).toHaveLength(0);
  });

  it("respects topK", () => {
    const results = retrieveTopChunks(chunks, "equations fractions triangles", 1);
    expect(results).toHaveLength(1);
  });
});
