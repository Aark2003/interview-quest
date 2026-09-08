import questionBank from './question-bank.json' with { type: 'json' };
export type Track = 'Frontend' | 'Backend';
export type Question = {
  id: string;
  text: string;
  topic: string;
  track: Track;
  source: string;
};
export const sheets = {
  Frontend: '1V0vB7116UVwII2q31jx1iKNF7TIwx6d99xyi-KO0Mw8',
  Backend: '1x2mNlkBj_9jVxCG5jRsrZvViSyJr_SU3A7Eor37eSTE',
};
export const defaultQuestions: Question[] = questionBank as Question[];
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
export function extractQuestions(rows: string[][], track: Track): Question[] {
  const headerIndex = rows.findIndex((r) =>
    r.some((c) =>
      /^(questions?|interview questions?|question text)$/i.test(c.trim()),
    ),
  );
  const col =
    headerIndex >= 0
      ? rows[headerIndex].findIndex((c) =>
          /^(questions?|interview questions?|question text)$/i.test(c.trim()),
        )
      : -1;
  const topicCol =
    headerIndex >= 0
      ? rows[headerIndex].findIndex((c) =>
          /^(topic|category|subject)$/i.test(c.trim()),
        )
      : -1;
  return rows.slice(headerIndex >= 0 ? headerIndex + 1 : 0).flatMap((r, i) => {
    const text = (
      col >= 0
        ? r[col]
        : r.find(
            (c) =>
              c.trim().length > 18 &&
              !/^https?:\/\//.test(c.trim()) &&
              !/^(completed|pending|done)$/i.test(c.trim()),
          )
    )?.trim();
    return text && text.length > 8
      ? [
          {
            id: `sheet-${track}-${i}`,
            text: text.slice(0, 2000),
            track,
            topic: topicCol >= 0 ? r[topicCol]?.trim() || track : track,
            source: 'Google Sheets • first tab',
          },
        ]
      : [];
  });
}
