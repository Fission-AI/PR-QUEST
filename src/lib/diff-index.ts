export type DiffFileStatus = "added" | "deleted" | "modified" | "renamed" | "copied";

export interface DiffHunk {
  hunk_id: string;
  old_start: number;
  new_start: number;
  header: string;
}

export interface DiffFileEntry {
  file_id: string;
  status: DiffFileStatus;
  language: string | null;
  hunks: DiffHunk[];
}

export interface DiffIndex {
  diff_index_version: 1;
  files: DiffFileEntry[];
}

interface WorkingDiffFile {
  oldPath: string | null;
  newPath: string | null;
  status: DiffFileStatus;
  binary: boolean;
  hunks: { oldStart: number; newStart: number; header: string }[];
}

const DIFF_HEADER_REGEX =
  /^diff --git (?:"a\/(.+)"|a\/([^\s]+)) (?:"b\/(.+)"|b\/([^\s]+))$/;
const FILE_PATH_REGEX = /^(?:"[ab]\/(.+)"|[ab]\/([^\s]+)|\/dev\/null)$/;
const HUNK_HEADER_REGEX = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

function normalizeDiffLineEndings(diffText: string) {
  return diffText.replaceAll("\r\n", "\n");
}

function extractPath(matchedGroups: RegExpMatchArray | null, primaryIndex: number, fallbackIndex: number) {
  if (!matchedGroups) {
    return null;
  }

  return matchedGroups[primaryIndex] ?? matchedGroups[fallbackIndex] ?? null;
}

function stripPrefix(path: string | null) {
  if (!path) {
    return null;
  }

  if (path.startsWith("a/") || path.startsWith("b/")) {
    return path.slice(2);
  }

  return path;
}

function unquotePath(path: string | null) {
  if (!path) {
    return null;
  }

  if (path.startsWith('"') && path.endsWith('"')) {
    return path.slice(1, -1);
  }

  return path;
}

function normalizePath(path: string | null) {
  if (!path) {
    return null;
  }

  const trimmed = path.trim();

  if (trimmed === "/dev/null") {
    return null;
  }

  return stripPrefix(unquotePath(trimmed));
}

function parseDiffHeader(line: string): { oldPath: string | null; newPath: string | null } | null {
  const match = line.match(DIFF_HEADER_REGEX);
  if (!match) {
    return null;
  }

  const oldPath = extractPath(match, 1, 2);
  const newPath = extractPath(match, 3, 4);

  return {
    oldPath: normalizePath(oldPath),
    newPath: normalizePath(newPath),
  };
}

function parseFilePathLine(line: string) {
  const match = line.match(FILE_PATH_REGEX);
  if (!match) {
    return null;
  }

  return normalizePath(match[1] ?? match[2] ?? line);
}

function parseHunkHeader(line: string) {
  const match = line.match(HUNK_HEADER_REGEX);
  if (!match) {
    return null;
  }

  const oldStart = Number.parseInt(match[1] ?? "0", 10);
  const newStart = Number.parseInt(match[2] ?? "0", 10);

  return { oldStart, newStart };
}

function determineFileId(file: WorkingDiffFile) {
  if (file.status === "deleted") {
    return file.oldPath ?? file.newPath ?? "";
  }

  if (file.status === "renamed" || file.status === "copied") {
    return file.newPath ?? file.oldPath ?? "";
  }

  return file.newPath ?? file.oldPath ?? "";
}

function detectLanguage(path: string) {
  const filename = path.split("/").pop();
  if (!filename) {
    return null;
  }

  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex <= 0 || lastDotIndex === filename.length - 1) {
    return null;
  }

  return filename.slice(lastDotIndex + 1).toLowerCase();
}

function createWorkingFile(header: { oldPath: string | null; newPath: string | null }): WorkingDiffFile {
  return {
    oldPath: header.oldPath,
    newPath: header.newPath,
    status: "modified",
    binary: false,
    hunks: [],
  };
}

function finalizeWorkingFile(file: WorkingDiffFile | null): DiffFileEntry | null {
  if (!file || file.binary) {
    return null;
  }

  const fileId = determineFileId(file);
  if (!fileId) {
    return null;
  }

  const language = detectLanguage(fileId);

  const hunks: DiffHunk[] = file.hunks.map((hunk, index) => ({
    hunk_id: `${fileId}#h${index}`,
    old_start: hunk.oldStart,
    new_start: hunk.newStart,
    header: hunk.header,
  }));

  return {
    file_id: fileId,
    status: file.status,
    language,
    hunks,
  };
}

function registerMetaLine(line: string, file: WorkingDiffFile) {
  if (line.startsWith("new file mode")) {
    file.status = "added";
    return;
  }

  if (line.startsWith("deleted file mode")) {
    file.status = "deleted";
    return;
  }

  if (line.startsWith("rename from ")) {
    file.status = "renamed";
    const path = normalizePath(line.slice("rename from ".length));
    file.oldPath = path ?? file.oldPath;
    return;
  }

  if (line.startsWith("rename to ")) {
    file.status = "renamed";
    const path = normalizePath(line.slice("rename to ".length));
    file.newPath = path ?? file.newPath;
    return;
  }

  if (line.startsWith("copy from ")) {
    file.status = "copied";
    const path = normalizePath(line.slice("copy from ".length));
    file.oldPath = path ?? file.oldPath;
    return;
  }

  if (line.startsWith("copy to ")) {
    file.status = "copied";
    const path = normalizePath(line.slice("copy to ".length));
    file.newPath = path ?? file.newPath;
  }
}

function updateFilePathsFromMarker(line: string, file: WorkingDiffFile) {
  if (line.startsWith("--- ")) {
    file.oldPath = parseFilePathLine(line.slice(4)) ?? file.oldPath;
    if (!file.oldPath) {
      file.status = "added";
    }
    return;
  }

  if (line.startsWith("+++ ")) {
    file.newPath = parseFilePathLine(line.slice(4)) ?? file.newPath;
    if (!file.newPath) {
      file.status = file.status === "renamed" ? file.status : "deleted";
    }
  }
}

function registerBinaryMarker(line: string, file: WorkingDiffFile) {
  if (line.startsWith("Binary files ") || line.startsWith("Binary file ") || line.startsWith("GIT binary patch")) {
    file.binary = true;
  }
}

function registerHunk(line: string, file: WorkingDiffFile) {
  if (!line.startsWith("@@")) {
    return;
  }

  const parsed = parseHunkHeader(line);
  if (!parsed) {
    return;
  }

  file.hunks.push({
    oldStart: parsed.oldStart,
    newStart: parsed.newStart,
    header: line,
  });
}

export function parseUnifiedDiff(diffText: string): DiffIndex {
  const normalized = normalizeDiffLineEndings(diffText);
  const lines = normalized.split("\n");

  const files: DiffFileEntry[] = [];
  let currentFile: WorkingDiffFile | null = null;

  const flushCurrent = () => {
    const finalized = finalizeWorkingFile(currentFile);
    if (finalized) {
      files.push(finalized);
    }
    currentFile = null;
  };

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      flushCurrent();
      const header = parseDiffHeader(line);
      currentFile = header ? createWorkingFile(header) : null;
      continue;
    }

    if (!currentFile) {
      continue;
    }

    registerBinaryMarker(line, currentFile);
    if (currentFile.binary) {
      continue;
    }

    if (line.startsWith("@@")) {
      registerHunk(line, currentFile);
      continue;
    }

    if (line.startsWith("--- ") || line.startsWith("+++ ")) {
      updateFilePathsFromMarker(line, currentFile);
      continue;
    }

    if (
      line.startsWith("new file mode") ||
      line.startsWith("deleted file mode") ||
      line.startsWith("rename from ") ||
      line.startsWith("rename to ") ||
      line.startsWith("copy from ") ||
      line.startsWith("copy to ")
    ) {
      registerMetaLine(line, currentFile);
    }
  }

  flushCurrent();

  return {
    diff_index_version: 1,
    files,
  };
}
