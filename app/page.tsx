'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Code2,
  Server,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Mic,
  ListChecks,
  Check,
  RefreshCw,
  BookOpen,
  Square,
} from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { defaultQuestions, type Question, type Track } from '@/lib/questions';
import type { Feedback } from '@/lib/quiz';
import { apiUrl } from '@/lib/api';
type Mode = 'mcq' | 'answer';
type Stage = 'pick' | 'mode' | 'play' | 'feedback';
async function post<T>(body: unknown) {
  const r = await fetch(apiUrl('/api/quiz'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await r.json()) as T & { error?: string };
  if (!r.ok)
    throw new Error(data.error || 'Something went wrong. Please retry.');
  return data;
}
async function blobToBase64(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
async function transcribe(blob: Blob) {
  const r = await fetch(apiUrl('/api/transcribe'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio: await blobToBase64(blob),
      mimeType: blob.type || 'audio/webm',
    }),
  });
  const data = (await r.json()) as { transcript?: string; error?: string };
  if (!r.ok) throw new Error(data.error || 'Could not transcribe audio.');
  return data.transcript || '';
}
export default function Home() {
  const [track, setTrack] = useState<Track>('Frontend'),
    [questions, setQuestions] = useState<Question[]>(defaultQuestions),
    [question, setQuestion] = useState<Question | null>(null),
    [stage, setStage] = useState<Stage>('pick'),
    [mode, setMode] = useState<Mode>('mcq'),
    [options, setOptions] = useState<string[]>([]),
    [token, setToken] = useState(''),
    [selected, setSelected] = useState(''),
    [answer, setAnswer] = useState(''),
    [feedback, setFeedback] = useState<Feedback | null>(null),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [ready, setReady] = useState<boolean | null>(null),
    [listening, setListening] = useState(false),
    [interim, setInterim] = useState(''),
    [rounds, setRounds] = useState(0),
    [correct, setCorrect] = useState(0),
    [paste, setPaste] = useState(''),
    [manage, setManage] = useState(false),
    [notice, setNotice] = useState(''),
    [supported, setSupported] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null),
    chunks = useRef<Blob[]>([]),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    lock = useRef(false),
    live = useRef(true);
  const visible = questions.filter((q) => q.track === track);
  useEffect(() => {
    live.current = true;
    setSupported(!!navigator.mediaDevices?.getUserMedia && !!window.MediaRecorder);
    void fetch(apiUrl('/api/quiz'))
      .then((r) => r.json() as Promise<{ ready: boolean }>)
      .then((d) => setReady(d.ready))
      .catch(() => setReady(false));
    setQuestions(defaultQuestions);
    try {
      const saved = JSON.parse(localStorage.getItem('iq-questions') || 'null');
      if (
        Array.isArray(saved) &&
        saved.every(
          (q) =>
            typeof q.id === 'string' &&
            typeof q.text === 'string' &&
            typeof q.topic === 'string' &&
            typeof q.source === 'string' &&
            ['Frontend', 'Backend'].includes(q.track),
        )
      )
        setQuestions([
          ...defaultQuestions.filter(
            (q) => !saved.some((s) => s.track === q.track),
          ),
          ...saved,
        ]);
    } catch {}
    return () => {
      live.current = false;
      recorder.current?.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  function stop() {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    if (timer.current) clearTimeout(timer.current);
  }
  function reset() {
    stop();
    setStage('pick');
    setQuestion(null);
    setError('');
    setFeedback(null);
    setAnswer('');
    setInterim('');
    setToken('');
    setSelected('');
  }
  function choose(q: Question) {
    if (lock.current) return;
    stop();
    setQuestion(q);
    setStage('mode');
    setError('');
    setFeedback(null);
    setAnswer('');
    setInterim('');
    setSelected('');
    setToken('');
  }
  async function start(m: Mode) {
    if (!question || lock.current) return;
    lock.current = true;
    setMode(m);
    setBusy('Building your round…');
    setError('');
    try {
      const d = await post<{ options: string[]; token: string }>({
        action: 'generate',
        question: question.text,
      });
      setOptions(d.options);
      setToken(d.token);
      setStage('play');
      setSelected('');
      setAnswer('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
      lock.current = false;
    }
  }
  async function grade(skip = false) {
    if (lock.current || !token) return;
    stop();
    lock.current = true;
    setBusy(
      skip ? 'Preparing your explanation…' : 'Thinking through your answer…',
    );
    setError('');
    try {
      const d = await post<Feedback>({
        action: 'grade',
        token,
        mode,
        selected: Number(selected),
        answer,
        skip,
      });
      setFeedback(d);
      setStage('feedback');
      setRounds((n) => n + 1);
      setCorrect((n) => n + (d.verdict === 'correct' ? 1 : 0));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
      lock.current = false;
    }
  }
  async function speak() {
    if (listening) {
      stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(
        'Voice recording is unavailable here. Open the game in Chrome, or type your answer below.',
      );
      return;
    }
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      stream.current = audioStream;
      chunks.current = [];
      const r = new MediaRecorder(audioStream);
      recorder.current = r;
      r.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      r.onerror = () => {
        setListening(false);
        setBusy('');
        setError('Recording stopped. Try again or type your answer.');
      };
      r.onstop = () => {
        const recording = new Blob(chunks.current, {
          type: chunks.current[0]?.type || r.mimeType || 'audio/webm',
        });
        stream.current?.getTracks().forEach((track) => track.stop());
        stream.current = null;
        if (live.current) setListening(false);
        if (!recording.size) {
          setError('No audio was recorded. Try again or type your answer.');
          return;
        }
        setBusy('Transcribing your answer...');
        void transcribe(recording)
          .then((text) => {
            setAnswer((current) =>
              [current, text].filter(Boolean).join(' ').trim().slice(0, 10000),
            );
            setError('');
          })
          .catch((e) => setError((e as Error).message))
          .finally(() => setBusy(''));
      };
      setError('');
      setInterim('');
      r.start();
      setListening(true);
      timer.current = setTimeout(() => stop(), 120000);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        setError(
          'Microphone access was denied. Allow it in your browser settings, or type your answer.',
        );
      } else {
        setError(
          'Could not start the microphone. Please type your answer or try again.',
        );
      }
    }
  }
  function saveBank(next: Question[]) {
    setQuestions(next);
    try {
      localStorage.setItem(
        'iq-questions',
        JSON.stringify(next.filter((q) => !q.id.startsWith('starter-'))),
      );
    } catch {
      setNotice(
        'Questions loaded for this session. Browser storage is unavailable.',
      );
    }
  }
  async function sync() {
    if (lock.current) return;
    lock.current = true;
    setBusy('Reading your sheet…');
    setError('');
    setNotice('');
    try {
      const r = await fetch(apiUrl(`/api/questions?track=${track}`));
      const d = (await r.json()) as { questions: Question[]; error?: string };
      if (!r.ok) throw new Error(d.error);
      saveBank([...questions.filter((q) => q.track !== track), ...d.questions]);
      setNotice(
        `Loaded ${d.questions.length} ${track.toLowerCase()} questions from the first tab.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
      lock.current = false;
    }
  }
  function importPaste() {
    const lines = [
      ...new Set(
        paste
          .split('\n')
          .map((s) => s.trim().replace(/^\d+[.)]\s*/, ''))
          .filter((s) => s.length >= 8),
      ),
    ];
    if (!lines.length) {
      setError('Paste at least one question, with one question per line.');
      return;
    }
    const next = lines.map((text, i) => ({
      id: `paste-${track}-${Date.now()}-${i}`,
      text: text.slice(0, 2000),
      topic: track,
      track,
      source: 'Your pasted questions',
    }));
    saveBank([...questions.filter((q) => q.track !== track), ...next]);
    setPaste('');
    setError('');
    setNotice(
      `${next.length} questions added to ${track}. Saved on this device.`,
    );
  }
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: { registerTool: (tool: unknown, opts: unknown) => void };
      }
    ).modelContext;
    if (!context) return;
    const controller = new AbortController();
    try {
      context.registerTool(
        {
          name: 'choose_interview_question',
          description:
            'Choose a visible interview question and open its mode selector. Does not submit an answer.',
          inputSchema: {
            type: 'object',
            properties: { questionId: { type: 'string' } },
            required: ['questionId'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: async (input: unknown) => {
            const id = (input as { questionId?: unknown })?.questionId;
            if (typeof id !== 'string')
              throw new Error('questionId must be a string');
            const q = questions.find((q) => q.id === id);
            if (!q || lock.current)
              throw new Error('Question unavailable or a round is loading');
            setTrack(q.track);
            choose(q);
            await new Promise((resolve) => setTimeout(resolve, 0));
            return { questionId: q.id, stage: 'mode' };
          },
        },
        { signal: controller.signal },
      );
    } catch {}
    return () => controller.abort();
  }, [questions]);
  return (
    <main className="shell">
      <header>
        <a className="brand" href="/">
          <span className="brand-icon">
            <Code2 />
          </span>
          interview<span className="accent">quest</span>
        </a>
        <span className="top-note">PRACTICE. UNDERSTAND. LEVEL UP.</span>
      </header>
      <section className="intro">
        <div>
          <span className="eyebrow">YOUR NEXT LEVEL STARTS HERE</span>
          <h1>
            Small rounds.
            <br />
            Big interview energy<span className="accent">.</span>
          </h1>
          <p>Pick a question. Give it a shot. Learn something that sticks.</p>
        </div>
        <div className="session">
          <span className="eyebrow">THIS SESSION</span>
          <strong>
            {String(rounds).padStart(2, '0')}
            <small>questions practiced</small>
          </strong>
          <span>{correct} answered well</span>
        </div>
      </section>
      <section className="workspace">
        <aside>
          <span className="eyebrow">01 / CHOOSE YOUR TRACK</span>
          {(['Frontend', 'Backend'] as Track[]).map((t) => (
            <button
              key={t}
              disabled={!!busy}
              onClick={() => {
                setTrack(t);
                reset();
                setNotice('');
              }}
              className={'track ' + (track === t ? 'active' : '')}
            >
              {t === 'Frontend' ? <Code2 /> : <Server />}
              <div>
                <strong>{t}</strong>
                <small>
                  {t === 'Frontend'
                    ? 'Interfaces, browsers & JavaScript'
                    : 'APIs, databases & architecture'}
                </small>
              </div>
              <ArrowRight size={18} />
            </button>
          ))}
          <div className="coach-note">
            <Sparkles />
            <h3>Progress over perfection.</h3>
            <p>
              Getting it wrong is part of practice. Every answer is a chance to
              understand the idea more clearly.
            </p>
          </div>
          <button
            className="text-button bank-toggle"
            disabled={!!busy}
            onClick={() => {
              reset();
              setManage(!manage);
            }}
          >
            {' '}
            <BookOpen size={17} />{' '}
            {manage ? 'Back to questions' : 'Manage question bank'}
          </button>
        </aside>
        <article className="arena" aria-busy={!!busy}>
          {busy && (
            <div className="loading" role="status">
              <RefreshCw className="spin" size={18} />
              {busy}
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="success" role="status">
              {notice}
            </div>
          )}
          {stage === 'pick' && (
            <>
              <span className="eyebrow">
                02 / {manage ? 'YOUR QUESTION BANK' : 'PICK A QUESTION'}
              </span>
              <div className="section-title">
                <h2>
                  {manage ? 'Bring your questions.' : `${track} practice`}
                </h2>
                <span className="pill">{visible.length} questions</span>
              </div>
              {manage ? (
                <>
                  <p>
                    Sync the first tab of your Google Sheet, or paste one
                    question per line. This replaces this track’s current
                    question list on this device.
                  </p>
                  <div className="import-actions">
                    <a
                      className="text-button"
                      href={`https://docs.google.com/spreadsheets/d/${track === 'Frontend' ? '1V0vB7116UVwII2q31jx1iKNF7TIwx6d99xyi-KO0Mw8' : '1x2mNlkBj_9jVxCG5jRsrZvViSyJr_SU3A7Eor37eSTE'}/edit?gid=0`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open {track} sheet ↗
                    </a>
                    <button
                      className="primary"
                      disabled={!!busy}
                      onClick={sync}
                    >
                      <RefreshCw size={16} />
                      Sync sheet
                    </button>
                  </div>
                  <label className="field-label" htmlFor="paste">
                    Or paste your questions
                  </label>
                  <textarea
                    id="paste"
                    value={paste}
                    maxLength={100000}
                    onChange={(e) => setPaste(e.target.value)}
                    placeholder="What is a closure in JavaScript?\nHow does the event loop work?"
                    rows={7}
                  />
                  <button
                    className="primary"
                    disabled={!paste.trim() || !!busy}
                    onClick={importPaste}
                  >
                    Import questions <ArrowRight size={16} />
                  </button>
                </>
              ) : (
                <>
                  <p>
                    Choose what you want to work on. You’ll pick your answer
                    mode next.
                  </p>
                  <div className="source-line">
                    {visible[0]?.source || 'No questions yet'}
                  </div>
                  <div className="question-list">
                    {visible.map((q, i) => (
                      <button
                        className="question-row"
                        key={q.id}
                        disabled={!!busy}
                        onClick={() => {
                          setManage(false);
                          choose(q);
                        }}
                      >
                        <span className="question-number">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span>
                          <small>{q.topic}</small>
                          <strong>{q.text}</strong>
                        </span>
                        <ArrowRight size={18} />
                      </button>
                    ))}
                  </div>
                </>
              )}
              {ready === false && (
                <div className="notice setup">
                  <Sparkles size={18} />
                  <span>
                    <strong>AI connection needed</strong>
                    <br />
                    The game needs a server API key before it can generate
                    options or check answers. Your questions are ready to
                    browse.
                  </span>
                  <button
                    className="text-button"
                    onClick={() =>
                      fetch(apiUrl('/api/quiz'))
                        .then((r) => r.json() as Promise<{ ready: boolean }>)
                        .then((d) => {
                          setReady(d.ready);
                          setNotice(
                            d.ready
                              ? 'AI connected. You can start a round.'
                              : 'AI is not connected yet.',
                          );
                        })
                        .catch(() => setError('Could not check AI status.'))
                    }
                  >
                    Recheck
                  </button>
                </div>
              )}
            </>
          )}
          {stage === 'mode' && question && (
            <>
              <button
                className="text-button back"
                disabled={!!busy}
                onClick={reset}
              >
                <ArrowLeft size={16} />
                All questions
              </button>
              <span className="eyebrow">02 / CHOOSE YOUR MODE</span>
              <div className="question-heading">
                <span className="pill">{question.topic}</span>
                <h2>{question.text}</h2>
              </div>
              <p>How do you want to answer this one?</p>
              <div className="mode-grid">
                <button
                  disabled={!!busy}
                  className="mode"
                  onClick={() => start('mcq')}
                >
                  <ListChecks />
                  <h3>MCQ mode</h3>
                  <p>
                    Four AI-generated options.
                    <br />
                    Test your understanding.
                  </p>
                  <span>
                    Choose an answer <ArrowRight size={16} />
                  </span>
                </button>
                <button
                  disabled={!!busy}
                  className="mode"
                  onClick={() => start('answer')}
                >
                  <Mic />
                  <h3>Answer mode</h3>
                  <p>
                    Say it in your own words.
                    <br />
                    Get feedback that makes sense.
                  </p>
                  <span>
                    Speak your answer <ArrowRight size={16} />
                  </span>
                </button>
              </div>
              <div className="notice">
                No answer key needed. AI prepares the reference answer and
                explains the concepts after your attempt.
              </div>
            </>
          )}
          {stage === 'play' && question && (
            <>
              <button
                className="text-button back"
                disabled={!!busy}
                onClick={() => {
                  stop();
                  setStage('mode');
                  setError('');
                }}
              >
                <ArrowLeft size={16} />
                Change mode
              </button>
              <div className="section-title">
                <span className="eyebrow">
                  03 / {mode === 'mcq' ? 'MAKE YOUR PICK' : 'SAY IT YOUR WAY'}
                </span>
                <span className="pill">
                  {mode === 'mcq' ? 'MCQ' : 'Spoken answer'}
                </span>
              </div>
              <h2 className="play-question">{question.text}</h2>
              {mode === 'mcq' ? (
                <RadioGroup
                  aria-label="Answer options"
                  value={selected}
                  onValueChange={(v) => setSelected(String(v))}
                  disabled={!!busy}
                  className="options"
                >
                  {options.map((o, i) => (
                    <label
                      key={i}
                      className={
                        'option ' + (selected === String(i) ? 'chosen' : '')
                      }
                    >
                      <RadioGroupItem value={String(i)} />
                      <span className="letter">{'ABCD'[i]}</span>
                      <span>{o}</span>
                    </label>
                  ))}
                </RadioGroup>
              ) : (
                <>
                  <div
                    className={'speech-panel ' + (listening ? 'recording' : '')}
                  >
                    <button
                      className="mic-button"
                      disabled={!!busy || !supported}
                      onClick={speak}
                      aria-label={
                        listening ? 'Stop recording' : 'Start recording'
                      }
                    >
                      {listening ? <Square size={24} /> : <Mic size={26} />}
                    </button>
                    <h3>
                      {listening
                        ? 'Listening… take your time.'
                        : 'Explain it like you would to a friend.'}
                    </h3>
                    <p>
                      {supported
                        ? listening
                          ? 'Tap stop when you are finished.'
                          : 'Tap the microphone to record. You can also type below.'
                        : 'Voice is unavailable in this browser. Use Chrome, or type below.'}
                    </p>
                    {interim && (
                      <p className="interim" aria-live="polite">
                        {interim}
                      </p>
                    )}
                  </div>
                  <label className="field-label" htmlFor="answer">
                    Your answer <span>Review and edit before sending</span>
                  </label>
                  <textarea
                    id="answer"
                    value={answer}
                    disabled={!!busy || listening}
                    maxLength={10000}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Your words will appear here. It’s okay to keep it simple."
                    rows={6}
                  />
                  <p className="privacy">
                    Your recording is sent to Gemini only to create the
                    transcript. You can edit the text before checking it.
                  </p>
                </>
              )}
              <div className="round-actions">
                <button
                  className="text-button"
                  disabled={!!busy || listening}
                  onClick={() => grade(true)}
                >
                  I don’t know — teach me
                </button>
                <button
                  className="primary"
                  disabled={
                    !!busy ||
                    listening ||
                    (mode === 'mcq' ? selected === '' : !answer.trim())
                  }
                  onClick={() => grade()}
                >
                  Check my answer <ArrowRight size={17} />
                </button>
              </div>
            </>
          )}
          {stage === 'feedback' && feedback && question && (
            <>
              <span className="eyebrow">ROUND COMPLETE / KEEP GROWING</span>
              <div className={'result ' + feedback.verdict}>
                <span className="result-icon">
                  {feedback.verdict === 'correct' ? <Check /> : <BookOpen />}
                </span>
                <div>
                  <h2>
                    {feedback.verdict === 'correct'
                      ? 'That’s the idea!'
                      : feedback.verdict === 'partial'
                        ? 'You’re on the right track.'
                        : feedback.verdict === 'learn'
                          ? 'Let’s learn this one.'
                          : 'A little clarity goes a long way.'}
                  </h2>
                  <p>{feedback.summary}</p>
                </div>
              </div>
              <p className="review-question">{question.text}</p>
              {mode === 'answer' && answer && (
                <details>
                  <summary>Your answer</summary>
                  <p>{answer}</p>
                </details>
              )}
              {feedback.strengths.length > 0 && (
                <section className="feedback-section">
                  <h3>
                    <Check size={17} />
                    What you got right
                  </h3>
                  <ul>
                    {feedback.strengths.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </section>
              )}
              {feedback.corrections.length > 0 && (
                <section className="feedback-section">
                  <h3>What to improve</h3>
                  <ul>
                    {feedback.corrections.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </section>
              )}
              <section className="answer-card">
                <span className="eyebrow">A SIMPLE ANSWER</span>
                <p>{feedback.answer}</p>
              </section>
              <section className="feedback-section">
                <h3>Let’s break it down</h3>
                <p>{feedback.explanation}</p>
              </section>
              <section className="example">
                <h3>A concrete example</h3>
                <p>{feedback.example}</p>
              </section>
              <section className="feedback-section">
                <h3>Remember these points</h3>
                <ul>
                  {feedback.keyPoints.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </section>
              <p className="privacy">
                AI feedback can make mistakes. Use it as coaching, and check
                official documentation for details.
              </p>
              <div className="round-actions">
                <button
                  className="text-button"
                  onClick={() => choose(question)}
                >
                  <RefreshCw size={16} />
                  Try again
                </button>
                <button
                  className="primary"
                  onClick={() => {
                    const i = visible.findIndex((q) => q.id === question.id);
                    choose(visible[(i + 1) % visible.length]);
                  }}
                >
                  Next question
                  <ArrowRight size={17} />
                </button>
              </div>
            </>
          )}
        </article>
      </section>
      <footer>
        <span>One question at a time.</span>
        <span>Your pace. Your progress.</span>
      </footer>
    </main>
  );
}
