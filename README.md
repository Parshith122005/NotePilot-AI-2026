# NotePilot AI

Study workspace for college students: AI summaries, MCQ quizzes, flashcards, a local Study Library, a Pomodoro timer and local progress tracking. Plain HTML/CSS/JS frontend + Spring Boot 4.0.6 (Java 26) backend. All AI calls go through the backend to Hugging Face (`deepseek-ai/DeepSeek-V4.1-Flash`).

## Structure
```
index.html  style.css  script.js      static frontend
backend/pom.xml  Dockerfile           Spring Boot app
backend/src/main/java/com/notepilot/notepilot/{controller,model,service}
backend/src/test/java/.../service/AiServiceTest.java
.env.example  .gitignore
```

## Run locally
1. **Backend (IntelliJ):** open `backend/` as a Maven project, set the run-configuration environment variable `HF_TOKEN=<your token>` (never commit it), run `NotepilotApplication`. It listens on `8080`.
   Or in a terminal: `cd backend && mvn spring-boot:run` (with `HF_TOKEN` set in your shell).
2. **Frontend:** open the repo folder in VS Code and click *Go Live* -> `http://127.0.0.1:5500/index.html`.
3. The frontend reads its API URL from `<meta name="api-base">` in `index.html` (default `http://localhost:8080/api`).

## Tests and build
`cd backend && mvn test` then `mvn package` (jar: `backend/target/notepilot-1.0.0.jar`). Tests never call Hugging Face and need no token. In IntelliJ: right-click `src/test/java` -> Run Tests.

## API (JSON)
| Endpoint | Request | Success response |
|---|---|---|
| `GET /api/health` | - | `{"status":"ok"}` |
| `POST /api/notes` | `{"text":"..."}` | `{"summary":"markdown"}` |
| `POST /api/quiz` | `{"text":"..."}` | `{"questions":[{"question","options":[],"correctIndex":0,"explanation"}]}` |
| `POST /api/flashcards` | `{"text":"..."}` | `{"cards":[{"front","back"}]}` |

Errors are always `{"error":"message"}`: 400 blank/invalid body, 413 too long, 429 upstream rate limit, 502 upstream/invalid AI output, 503 `HF_TOKEN` missing, 504 timeout.
If your original `NoteRequest` used a different field name than `text`, update `NoteRequest.java` and `script.js` together.

## Environment variables (backend)
| Variable | Purpose | Default |
|---|---|---|
| `HF_TOKEN` | Hugging Face token (secret) | none (AI endpoints return 503) |
| `CORS_ORIGINS` | comma-separated allowed frontend origins | `http://127.0.0.1:5500,http://localhost:5500` |
| `PORT` / `SERVER_PORT` | server port | `8080` |
| `HF_MODEL`, `HF_API_URL` | model and endpoint | DeepSeek-V4.1-Flash, HF router chat-completions |
| `HF_TIMEOUT_SECONDS`, `MAX_INPUT_CHARS` | timeout, input limit | `60`, `20000` |

## Deploy (frontend and backend are separate deployments)
**Backend on Render (Docker):** New Web Service -> connect the GitHub repo -> Root Directory `backend` -> Runtime Docker. Environment: `HF_TOKEN`, `CORS_ORIGINS=https://<your-frontend-domain>`. Health check path `/api/health`. Free instances sleep when idle, so the first request after a pause can take about a minute; check Render's current free-tier limits and pricing.
**Frontend on Cloudflare Pages:** connect the repo, no build command, output directory `/`. Before deploying, change `api-base` in `index.html` to `https://<your-render-service>.onrender.com/api` and commit. Then open the site and generate a summary to test the connection.

## Security notes
- `HF_TOKEN` lives only in backend environment variables; `.env` is git-ignored. Never put it in frontend files or localStorage.
- AI/user text is rendered with `textContent`, never raw HTML.
- A public, unauthenticated AI endpoint needs rate limiting and abuse protection before real traffic. This is not implemented.
- Request size is checked in the controller after the body is parsed; add a proxy-level body limit for production.

## Troubleshooting
- "Cannot reach the backend": backend not running, wrong `api-base`, or origin missing from `CORS_ORIGINS`.
- 503: `HF_TOKEN` not set for the running process.
- 502 "unusable response": the model returned malformed JSON twice; retry.

## Screenshots
_Placeholders: add dashboard-dark.png, dashboard-light.png, quiz.png._
