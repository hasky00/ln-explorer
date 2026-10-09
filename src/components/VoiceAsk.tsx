"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";

type Phase = "idle" | "listening" | "thinking" | "speaking";

interface Step {
  tool: string;
  args: Record<string, string>;
  spoken: string;
  isError: boolean;
}

interface Turn {
  question: string;
  spoken: string;
  steps: Step[];
}

// Minimal typing for the Web Speech API (not in TS's DOM lib everywhere).
interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

const EXAMPLES = [
  "How big is the Lightning Network?",
  "Tell me about ACINQ",
  "Look up Kraken",
  "Which node is behind jack@primal.net?",
];

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

export default function VoiceAsk() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [interim, setInterim] = useState("");
  const [typed, setTyped] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  // Speech support never changes after load; false on the server, real value in the browser.
  const canListen = useSyncExternalStore(
    noopSubscribe,
    () => getRecognitionCtor() !== null,
    () => false
  );
  const recognitionRef = useRef<Recognition | null>(null);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setPhase("idle");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1.02;
    utterance.onend = () => setPhase("idle");
    utterance.onerror = () => setPhase("idle");
    setPhase("speaking");
    window.speechSynthesis.speak(utterance);
  }, []);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q) return;
      setInterim("");
      setPhase("thinking");
      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question: q }),
        });
        const data = (await res.json()) as { spoken: string; steps: Step[] };
        setTurns((t) => [{ question: q, spoken: data.spoken, steps: data.steps }, ...t]);
        speak(data.spoken);
      } catch {
        const spoken = "Sorry, I couldn't reach E-light just now.";
        setTurns((t) => [{ question: q, spoken, steps: [] }, ...t]);
        speak(spoken);
      }
    },
    [speak]
  );

  const listen = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    if (phase === "listening") {
      recognitionRef.current?.stop();
      return;
    }
    window.speechSynthesis?.cancel();

    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";

    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText = text;
      }
      setInterim(text);
    };
    rec.onerror = () => setPhase("idle");
    rec.onend = () => {
      recognitionRef.current = null;
      if (finalText) void ask(finalText);
      else setPhase((p) => (p === "listening" ? "idle" : p));
    };

    recognitionRef.current = rec;
    setInterim("");
    setPhase("listening");
    rec.start();
  }, [ask, phase]);

  const status =
    phase === "listening"
      ? interim || "Listening…"
      : phase === "thinking"
        ? "Asking the Lightning Network…"
        : phase === "speaking"
          ? "Speaking"
          : canListen
            ? "Tap the light and ask a question"
            : "Type a question below (voice needs Chrome or Safari)";

  return (
    <div className="flex flex-col items-center gap-8">
      <button
        type="button"
        onClick={listen}
        disabled={!canListen || phase === "thinking"}
        aria-label={phase === "listening" ? "Stop listening" : "Ask by voice"}
        className="group relative grid h-40 w-40 place-items-center rounded-full disabled:cursor-not-allowed"
      >
        <span
          className={`absolute inset-0 rounded-full bg-amber-400/20 transition ${
            phase === "listening" ? "animate-ping" : ""
          }`}
        />
        <span
          className={`absolute inset-3 rounded-full border-4 transition ${
            phase === "idle"
              ? "border-amber-500/40"
              : phase === "thinking"
                ? "animate-spin border-amber-500 border-t-transparent"
                : "border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.6)]"
          }`}
        />
        <span className="relative font-mono text-5xl font-bold text-amber-500">E</span>
      </button>

      <p
        aria-live="polite"
        className="min-h-6 max-w-md text-center text-lg text-zinc-700 dark:text-zinc-300"
      >
        {status}
      </p>

      <form
        className="flex w-full max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(typed);
          setTyped("");
        }}
      >
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Or type: tell me about ACINQ"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={phase === "thinking"}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400 disabled:opacity-50"
        >
          Ask
        </button>
      </form>

      <div className="flex flex-wrap justify-center gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => void ask(ex)}
            disabled={phase === "thinking"}
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:border-amber-500 hover:text-amber-600 dark:border-zinc-700 dark:text-zinc-400"
          >
            {ex}
          </button>
        ))}
      </div>

      <ol className="flex w-full max-w-xl flex-col gap-4">
        {turns.map((turn, i) => (
          <li
            key={turns.length - i}
            className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <p className="text-sm text-zinc-500">You asked: &ldquo;{turn.question}&rdquo;</p>
            <p className="mt-2 text-base">{turn.spoken}</p>
            {turn.steps.length > 0 && (
              <details className="mt-3 text-xs text-zinc-500">
                <summary className="cursor-pointer select-none">
                  MCP calls ({turn.steps.length})
                </summary>
                <ul className="mt-2 flex flex-col gap-1 font-mono">
                  {turn.steps.map((s, j) => (
                    <li key={j} className={s.isError ? "text-red-500" : ""}>
                      {s.tool}({Object.entries(s.args)
                        .map(([k, v]) => `${k}: "${v.length > 20 ? v.slice(0, 20) + "…" : v}"`)
                        .join(", ")})
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
