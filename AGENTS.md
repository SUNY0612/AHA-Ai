# Repository Guidelines

## Project Structure & Module Organization

This is a small Node.js web application for generating Korean math solutions with NVIDIA Build's DeepSeek API.

- `server.js` serves the static frontend and exposes `POST /api/solve`.
- `index.html`, `styles.css`, and `script.js` contain the browser UI, styling, and form/API behavior.
- `.env.example` documents required runtime configuration; keep actual `.env` values local and uncommitted.
- There are currently no test or asset directories. Add tests in a dedicated `test/` directory if the project grows.

## Build, Test, and Development Commands

Use Node.js 20.6 or newer.

```bash
npm start
```

Starts the server with `.env` loaded and serves the app at `http://127.0.0.1:3000`.

There is no build step, dependency installation requirement, or automated test script currently defined. After changing frontend or server code, run `npm start` and exercise the solve form in a browser. Confirm both successful responses and validation/API error states.

## Coding Style & Naming Conventions

Use two-space indentation, semicolons, double-quoted JavaScript strings, and ES modules. Prefer `const`, small focused functions, and `camelCase` names for JavaScript variables/functions. Keep user-facing messages in Korean and preserve the existing status/error handling flow. Use kebab-case for CSS classes and lowercase filenames such as `script.js` and `styles.css`. No formatter or linter is configured, so keep changes consistent with neighboring code.

## Testing Guidelines

Automated tests are not yet configured. For manual verification, test an empty problem, a valid problem, an oversized request, a missing/invalid API key, and an unavailable API response. If adding tests, use descriptive names based on behavior and place them under `test/`.

## Commit & Pull Request Guidelines

Git history currently contains only `Initial project upload`, so no established commit convention is available. Use concise imperative commit subjects, for example `Handle NVIDIA API errors clearly`. Pull requests should describe the behavior change, configuration impact, manual test steps, and include a screenshot for visible UI changes. Never commit `.env` or expose API keys.

## Security & Configuration Tips

Set `NVIDIA_API_KEY` and `NVIDIA_MODEL=deepseek-ai/deepseek-v4.1-flash` in a local `.env` file; restart the server after changing either value. Keep the key server-side—browser code must call `/api/solve`, not NVIDIA Build directly.
