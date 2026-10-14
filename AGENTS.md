# Repository Guidelines

## Project Structure

- `server.py` runs the local HTTP server, serves the allowlisted frontend files, and provides the NVIDIA API routes.
- `index.html`, `solve.html`, `styles.css`, and `script.js` make up the browser experience.
- `test_server.py` contains standard-library tests. `.env.example` documents local settings; never commit the real `.env` file.

## Run and Test

Use Python 3.7 or newer; no package installation is required.

```bash
python3 server.py                 # Start at http://127.0.0.1:3000
python3 -m unittest -v            # Run local tests; NVIDIA calls are mocked
python3 -m py_compile server.py   # Check server syntax
```

On Windows, use `py -3 server.py` and `py -3 -m unittest -v`. Set `NVIDIA_API_KEY` in `.env`; `NVIDIA_MODEL` and `PORT` are optional. The server binds only to `127.0.0.1` and needs internet access to contact NVIDIA.

## Style and Changes

Use four spaces for Python indentation, descriptive `snake_case` names, and standard-library modules where practical. Keep browser JavaScript consistent with its existing two-space indentation and `camelCase` names. Keep student-facing text in Korean. There is no formatter or linter configured.

## Testing Expectations

Add tests to `test_server.py` using `unittest` and mock external API calls. Cover route behavior, input limits, JSON response shapes, and SSE event names. Do not put API keys or live API responses in fixtures.

## Commits and Configuration

Recent history uses short imperative or Conventional Commit subjects, such as `feat: add NVIDIA streaming solution flow`. Pull requests should include a behavior summary and test commands. Keep `.env`, API keys, and generated Python cache files out of commits.
