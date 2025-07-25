// Generated by Wrangler by running `wrangler types`

interface Env {
        ASSETS: Fetcher;
        OPENAI_API_KEY: string;
        GITHUB_TOKEN: string;
        GITHUB_REPO: string;
        SLACK_WEBHOOK_URL: string;
        pseudointelekt_contact_form: KVNamespace;
        pseudointelekt_views: KVNamespace;
        pseudointelekt_likes: KVNamespace;
        WORKER_ID: string;
        OPENAI_TEXT_MODEL: string;
        OPENAI_IMAGE_STYLE: string;
        OPENAI_IMAGE_QUALITY: string;
        pseudointelekt_logs_db: D1Database;
}
