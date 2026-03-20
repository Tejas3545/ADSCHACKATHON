type FileChange = {
  filename: string;
  additions: number;
};

export function validateRequiredPathPrefixes(
  filesChanged: FileChange[],
  requiredPathPrefixes: string[] | undefined
): { ok: true } | { ok: false; reason: string } {
  if (!requiredPathPrefixes || requiredPathPrefixes.length === 0) {
    return { ok: true };
  }

  const lowerFiles = filesChanged.map((f) => f.filename.toLowerCase());
  for (const prefixRule of requiredPathPrefixes) {
    const options = prefixRule
      .split("|")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);

    if (options.length === 0) continue;

    const hasAnyAllowedPrefix = options.some((prefix) =>
      lowerFiles.some((filename) => filename.startsWith(`${prefix}/`) || filename === prefix)
    );

    if (!hasAnyAllowedPrefix) {
      const display = options.map((option) => `'${option}/'`).join(" or ");
      return {
        ok: false,
        reason: `Changes must include files under ${display}`,
      };
    }
  }

  return { ok: true };
}

export function validateCommitMessageKeywords(
  commitMessages: string[],
  requiredKeywords: string[] | undefined
): { ok: true } | { ok: false; reason: string } {
  if (!requiredKeywords || requiredKeywords.length === 0) {
    return { ok: true };
  }

  const normalizedMessages = commitMessages
    .map((message) => message.trim().toLowerCase())
    .filter(Boolean);

  if (normalizedMessages.length === 0) {
    return {
      ok: false,
      reason: "No commit messages found for keyword validation",
    };
  }

  for (const message of normalizedMessages) {
    if (message.length < 4 || /^[\s.,'!?;:\-_+=*#@$%^&()[\]{}|\\/<>~`"]+$/.test(message)) {
      return {
        ok: false,
        reason: "Commit message is too weak (example: '.' is not allowed)",
      };
    }
  }

  const joined = normalizedMessages.join("\n");
  const hasKeyword = requiredKeywords.some((keyword) => joined.includes(keyword.toLowerCase()));

  if (!hasKeyword) {
    return {
      ok: false,
      reason: `Commit message must include at least one milestone keyword: ${requiredKeywords.join(", ")}`,
    };
  }

  return { ok: true };
}
