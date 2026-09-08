import {
  sheets,
  parseCSV,
  extractQuestions,
  type Track,
} from '@/lib/questions';
export async function GET(request: Request) {
  const track = new URL(request.url).searchParams.get('track');
  if (track !== 'Frontend' && track !== 'Backend')
    return Response.json({ error: 'Choose a valid track.' }, { status: 400 });
  try {
    const response = await fetch(
      `https://docs.google.com/spreadsheets/d/${sheets[track]}/export?format=csv&gid=0`,
      { signal: AbortSignal.timeout(15000) },
    );
    const text = await response.text();
    if (!response.ok || /<html|<!doctype|ServiceLogin/i.test(text))
      return Response.json(
        {
          error:
            'This sheet needs viewing access. Set sharing to “Anyone with the link can view”, then sync again. You can also paste questions below.',
        },
        { status: 403 },
      );
    if (text.length > 2_000_000)
      return Response.json(
        { error: 'This sheet is too large. Paste a smaller question list.' },
        { status: 413 },
      );
    const questions = extractQuestions(parseCSV(text), track as Track);
    if (!questions.length)
      return Response.json(
        {
          error:
            'No questions found. Use a column headed Question, or paste questions below.',
        },
        { status: 422 },
      );
    return Response.json({ questions });
  } catch {
    return Response.json(
      {
        error:
          'Could not reach Google Sheets. Try again or paste your questions.',
      },
      { status: 502 },
    );
  }
}
