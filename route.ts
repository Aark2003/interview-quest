function config() {
  return {
    provider: process.env.AI_PROVIDER || 'openai',
    key: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
  };
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: 'Please use the game to record answers.' },
      { status: 403 },
    );
  const { provider, key, model } = config();
  if (provider !== 'gemini')
    return Response.json(
      { error: 'Voice transcription currently uses Gemini. Set AI_PROVIDER=gemini.' },
      { status: 503 },
    );
  if (!key)
    return Response.json(
      { error: 'Add GEMINI_API_KEY on the server to transcribe voice answers.' },
      { status: 503 },
    );
  try {
    const body = (await request.json()) as { audio?: string; mimeType?: string };
    if (
      typeof body.audio !== 'string' ||
      body.audio.length < 100 ||
      body.audio.length > 10_000_000 ||
      typeof body.mimeType !== 'string'
    )
      return Response.json(
        { error: 'Record a short answer and try again.' },
        { status: 400 },
      );
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': key },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: 'Transcribe this interview practice answer in English. Return only the transcript text. Do not answer the interview question.',
                },
                { inlineData: { mimeType: body.mimeType, data: body.audio } },
              ],
            },
          ],
          generationConfig: { temperature: 0, maxOutputTokens: 1200 },
        }),
        signal: AbortSignal.timeout(55000),
      },
    );
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as {
        error?: { status?: string };
      } | null;
      return Response.json(
        {
          error:
            response.status === 503 || detail?.error?.status === 'UNAVAILABLE'
              ? 'Gemini voice transcription is busy right now. Try again in a minute.'
              : 'Could not transcribe this recording. Please try again or type your answer.',
        },
        { status: 502 },
      );
    }
    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const transcript =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || '')
        .join(' ')
        .trim() || '';
    if (!transcript)
      return Response.json(
        { error: 'No speech was detected. Try again or type your answer.' },
        { status: 422 },
      );
    return Response.json({ transcript });
  } catch {
    return Response.json(
      { error: 'Could not transcribe this recording. Please try again.' },
      { status: 502 },
    );
  }
}
