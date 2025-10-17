import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseUnifiedDiff } from "../diff-index";

function loadFixture(name: string) {
  const fixturePath = resolve(process.cwd(), "tests/fixtures", name);
  return readFileSync(fixturePath, "utf8");
}

describe("parseUnifiedDiff", () => {
  it("parses a single added file", () => {
    const result = parseUnifiedDiff(loadFixture("addition.diff"));

    expect(result).toMatchInlineSnapshot(`
      {
        "diff_index_version": 1,
        "files": [
          {
            "file_id": "src/hello.ts",
            "hunks": [
              {
                "header": "@@ -0,0 +1,3 @@",
                "hunk_id": "src/hello.ts#h0",
                "new_start": 1,
                "old_start": 0,
              },
            ],
            "language": "ts",
            "status": "added",
          },
        ],
      }
    `);
  });

  it("parses a renamed file with spaces in paths", () => {
    const result = parseUnifiedDiff(loadFixture("rename.diff"));

    expect(result).toMatchInlineSnapshot(`
      {
        "diff_index_version": 1,
        "files": [
          {
            "file_id": "src/new name.ts",
            "hunks": [
              {
                "header": "@@ -1,3 +1,3 @@",
                "hunk_id": "src/new name.ts#h0",
                "new_start": 1,
                "old_start": 1,
              },
            ],
            "language": "ts",
            "status": "renamed",
          },
        ],
      }
    `);
  });

  it("skips binary diffs entirely", () => {
    const result = parseUnifiedDiff(loadFixture("binary.diff"));

    expect(result).toMatchInlineSnapshot(`
      {
        "diff_index_version": 1,
        "files": [],
      }
    `);
  });

  it("captures multiple hunks for a single file", () => {
    const result = parseUnifiedDiff(loadFixture("multi-hunk.diff"));

    expect(result).toMatchInlineSnapshot(`
      {
        "diff_index_version": 1,
        "files": [
          {
            "file_id": "src/utils/math.ts",
            "hunks": [
              {
                "header": "@@ -1,5 +1,7 @@",
                "hunk_id": "src/utils/math.ts#h0",
                "new_start": 1,
                "old_start": 1,
              },
              {
                "header": "@@ -12,7 +14,9 @@ export function multiply(a: number, b: number) {",
                "hunk_id": "src/utils/math.ts#h1",
                "new_start": 14,
                "old_start": 12,
              },
            ],
            "language": "ts",
            "status": "modified",
          },
        ],
      }
    `);
  });

  it("marks deleted files correctly", () => {
    const result = parseUnifiedDiff(loadFixture("deletion.diff"));

    expect(result).toMatchInlineSnapshot(`
      {
        "diff_index_version": 1,
        "files": [
          {
            "file_id": "docs/notes.md",
            "hunks": [
              {
                "header": "@@ -1,3 +0,0 @@",
                "hunk_id": "docs/notes.md#h0",
                "new_start": 0,
                "old_start": 1,
              },
            ],
            "language": "md",
            "status": "deleted",
          },
        ],
      }
    `);
  });
});
