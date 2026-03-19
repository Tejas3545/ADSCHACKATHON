export async function fetchGitHubWithTokenFallback(
  url: string,
  headers: Record<string, string>
): Promise<Response> {
  const response = await fetch(url, { headers });
  if (response.status !== 401 || !headers.Authorization) {
    return response;
  }

  const retryHeaders = { ...headers };
  delete retryHeaders.Authorization;
  return fetch(url, { headers: retryHeaders });
}

export function buildGitHubHeaders(): Record<string, string> {
  const githubToken = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "ADSC-Leaderboard",
  };

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  return headers;
}
