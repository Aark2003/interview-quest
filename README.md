# Interview Quest

A personal frontend/backend interview practice game built with React, Vinext and Cloudflare Workers.

## Run locally

Use Node 24 or later. Run `npm install`, then `npm run dev`.
Copy `.env.example` to `.env` if it does not exist, choose an AI provider, add its server-side secret if needed, and restart the server. Never commit keys.

Supported providers:

- `AI_PROVIDER=gemini`: uses Google Gemini with `GEMINI_API_KEY`. This is the best low-cost/free-key option for deployment. `GEMINI_MODEL` defaults to `gemini-flash-lite-latest`.
- `AI_PROVIDER=ollama`: uses local Ollama at `OLLAMA_URL` with `OLLAMA_MODEL`. No API key is needed, but Ollama must be installed and running on the same machine as the server.
- `AI_PROVIDER=openai`: uses `OPENAI_API_KEY` and `OPENAI_MODEL`. API credits are billed separately from ChatGPT Plus.

Hosted configuration uses server secret environment variables. Keys are never passed to the browser. OpenAI API requests use `store: false`.

## Question bank

Both provided Google Sheets are wired into Manage question bank → Sync sheet. Only gid=0 (the first specified tab) is imported. The sheets must allow viewing without signing in for server-side CSV import. A column named Question (or Questions/Question text) is preferred. Optional Topic/Category/Subject columns are recognized. Headerless sheets use the first substantial non-URL text field; review the imported list if the sheet has a different structure.

Pasting one question per line replaces the selected track's bank. Imported questions are stored on this device in localStorage. The bundled bank contains 740 Frontend and 1,000 Backend questions imported from the provided sheets on 2026-09-08. Sync sheet refreshes a track from its source.

## Play

Select a question and then select MCQ or Answer mode. Every attempt asks AI for four options and a reference explanation. An encrypted, expiring round token prevents the reference and correct option being exposed before submission. MCQ marking uses that same round's answer key, and spoken answers are assessed against the question and reference. Feedback includes correct points, corrections, a model answer, an explanation, an example, and key concepts. “I don't know” reveals the lesson without claiming a correct response.

Voice uses browser audio recording with up to two minutes per answer. Browser support and microphone permission are required; typed answers work without voice. Stop recording and review the Gemini-generated transcript before submitting. The grading step sends the transcript, not audio, to the AI provider.

## Validation

- `npm test`: CSV extraction and MCQ/unknown-answer feedback regression tests.
- `npm run typecheck`
- `npm run build`

The local status endpoint and missing-key/invalid-track errors were checked. OpenAI connectivity was verified with a valid key, but the linked API account had no credits. Gemini and Ollama provider code is implemented; live generation/grading requires a configured Gemini key or a running local Ollama model. Microphone interaction was not browser-tested. An optional feature-detected WebMCP question-selection tool is included; no supported WebMCP validation context was available, so its runtime contract remains unverified.

The site is designed for owner-only access. Before sharing it with other users, add application-level quotas and account-level spending limits.

API implementation references: https://developers.openai.com/api/docs/guides/structured-outputs, https://ai.google.dev/api/generate-content, https://docs.ollama.com/api/generate
