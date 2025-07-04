export interface Env {
  OPENAI_API_KEY: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string; // owner/repo
  SLACK_WEBHOOK_URL: string;
  pseudointelekt_contact_form: KVNamespace;
}

import blogPostPrompt from "./prompt/blog-post.txt?raw";
import { logEvent, logError } from './utils/logger';

function slugify(text: string) {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    logEvent({ type: 'cron-start', time: event.scheduledTime });
    const date = new Date(event.scheduledTime).toISOString().split("T")[0];

    const prompt = blogPostPrompt.replace("${date}", date);

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const aiData: any = await aiRes.json();
    const markdown: string = aiData.choices[0].message.content.trim();
    const titleMatch = /^---\s*\ntitle:\s*(.+)\n/i.exec(markdown);
    const title = titleMatch ? titleMatch[1] : `Post ${date}`;
    const slug = slugify(title);
    const path = `src/content/blog/${date}-${slug}.md`;

    const repoUrl = `https://api.github.com/repos/${env.GITHUB_REPO}`;
    const headers = {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "User-Agent": "cron-worker",
      "Content-Type": "application/json",
    };

    const repoRes = await fetch(repoUrl, { headers });
    const repo: any = await repoRes.json();
    const refRes = await fetch(
      `${repoUrl}/git/ref/heads/${repo.default_branch}`,
      { headers }
    );
    const refData: any = await refRes.json();
    const branch = `auto-${date.replace(/-/g, "")}`;

    try {
      await fetch(`${repoUrl}/git/refs`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: refData.object.sha }),
      });

      await fetch(`${repoUrl}/contents/${encodeURIComponent(path)}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `Add post for ${date}`,
          content: btoa(markdown),
          branch,
        }),
      });

      await fetch(`${repoUrl}/pulls`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: `Automated post for ${date}`,
          head: branch,
          base: repo.default_branch,
          body: "This PR was created automatically by a scheduled Cloudflare Worker.",
        }),
      });
      logEvent({ type: 'cron-complete', branch });
    } catch (err) {
      logError(err, { type: 'cron-error' });
      throw err;
    }
  },
};
