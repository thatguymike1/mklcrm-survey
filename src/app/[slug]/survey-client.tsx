"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SnapshotQuestion, SurveySnapshot, LoadedResponse } from "@/lib/survey/types";
import { getImageUrl, isValidBunnyUrl, getBunnyEmbedUrl } from "@/lib/survey/media";

// ─── Image Lightbox ───────────────────────────────────────────────────────────

function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
        onClick={onClose}
        aria-label="Close image preview"
      >
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-w-[95vw] max-h-[95vh] object-contain rounded"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnswerState {
  text?: string;
  values?: string[];
}

type AnswerMap = Record<string, AnswerState>;

interface Props {
  slug: string;
  snapshot: SurveySnapshot;
  initialResponses: LoadedResponse[];
  initialSubmitted: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildInitialAnswers(responses: LoadedResponse[]): AnswerMap {
  return Object.fromEntries(
    responses.map((r) => [
      r.question_id,
      {
        text: r.answer_text ?? undefined,
        values: r.answer_values ?? undefined,
      },
    ]),
  );
}

function hasValidAnswer(q: SnapshotQuestion, ans?: AnswerState): boolean {
  if (!ans) return false;
  if (q.answer_type === "free_text") return (ans.text ?? "").trim().length > 0;
  return (ans.values ?? []).length > 0;
}

function getResumeIndex(
  questions: SnapshotQuestion[],
  answers: AnswerMap,
): number {
  const firstUnanswered = questions.findIndex(
    (q) => !hasValidAnswer(q, answers[q.id]),
  );
  if (firstUnanswered === -1) return Math.max(0, questions.length - 1);
  return firstUnanswered;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function QuestionMedia({
  question,
}: {
  question: SnapshotQuestion;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (question.media_type === "image" && question.image_path) {
    const src = getImageUrl(question.image_path);
    return (
      <>
        {/*
          Sizing strategy:
          - max-w-full: never overflow the column
          - h-auto: preserve natural aspect ratio
          - max-h-[70vh]: allow tall portrait docs to breathe; cap extreme heights
          - No min-width/w-full: small images (logos, banners) stay at their natural size
          - flex justify-center: center small images rather than left-aligning them
          - cursor-zoom-in: signals the image is clickable for inspection
        */}
        <div className="mb-5 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={question.question_text}
            className="max-w-full h-auto max-h-[70vh] object-contain rounded-lg bg-gray-50 cursor-zoom-in"
            loading="lazy"
            onClick={() => setLightboxOpen(true)}
          />
        </div>
        {lightboxOpen && (
          <ImageLightbox
            src={src}
            alt={question.question_text}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </>
    );
  }

  if (question.media_type === "video" && question.video_url) {
    if (!isValidBunnyUrl(question.video_url)) {
      return (
        <div className="mb-5 w-full aspect-video rounded-lg bg-gray-100 flex items-center justify-center text-sm text-gray-400">
          Video unavailable.
        </div>
      );
    }
    const ratio = question.video_aspect_ratio ?? "16:9";

    if (ratio === "9:16") {
      // Portrait: narrow, centered, phone-shaped player
      return (
        <div className="mb-5 flex justify-center">
          <div className="w-full max-w-[260px] max-h-[70vh] aspect-[9/16] rounded-lg overflow-hidden bg-black">
            <iframe
              src={getBunnyEmbedUrl(question.video_url)}
              title={question.question_text}
              className="w-full h-full"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>
      );
    }

    if (ratio === "1:1") {
      // Square: centered, moderate max-width
      return (
        <div className="mb-5 flex justify-center">
          <div className="w-full max-w-sm aspect-square rounded-lg overflow-hidden bg-black">
            <iframe
              src={getBunnyEmbedUrl(question.video_url)}
              title={question.question_text}
              className="w-full h-full"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>
      );
    }

    // Default: 16:9 landscape (also handles any unrecognised value from old snapshots)
    return (
      <div className="mb-5 w-full aspect-video rounded-lg overflow-hidden bg-black">
        <iframe
          src={getBunnyEmbedUrl(question.video_url)}
          title={question.question_text}
          className="w-full h-full"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }

  return null;
}

function SingleSelect({
  question,
  value,
  onChange,
  error,
}: {
  question: SnapshotQuestion;
  value: string | undefined;
  onChange: (optionId: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-3" role="radiogroup" aria-label={question.question_text}>
      {question.options.map((opt) => {
        const checked = value === opt.id;
        const inputId = `opt-${opt.id}`;
        return (
          <label
            key={opt.id}
            htmlFor={inputId}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
              checked
                ? "border-blue-600 bg-blue-50"
                : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            <input
              type="radio"
              id={inputId}
              name={`q-${question.id}`}
              value={opt.id}
              checked={checked}
              onChange={() => onChange(opt.id)}
              className="sr-only"
            />
            <span
              className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                checked ? "border-blue-600" : "border-gray-300"
              }`}
              aria-hidden="true"
            >
              {checked && (
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              )}
            </span>
            <span className="text-gray-800 text-base">{opt.option_text}</span>
          </label>
        );
      })}
      {error && (
        <p className="text-sm text-red-600 mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function MultiSelect({
  question,
  values,
  onChange,
  error,
}: {
  question: SnapshotQuestion;
  values: string[];
  onChange: (optionId: string, checked: boolean) => void;
  error?: string;
}) {
  return (
    <div className="space-y-3">
      {question.options.map((opt) => {
        const checked = values.includes(opt.id);
        const inputId = `opt-${opt.id}`;
        return (
          <label
            key={opt.id}
            htmlFor={inputId}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
              checked
                ? "border-blue-600 bg-blue-50"
                : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            <input
              type="checkbox"
              id={inputId}
              checked={checked}
              onChange={(e) => onChange(opt.id, e.target.checked)}
              className="sr-only"
            />
            <span
              className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                checked
                  ? "border-blue-600 bg-blue-600"
                  : "border-gray-300 bg-white"
              }`}
              aria-hidden="true"
            >
              {checked && (
                <svg
                  className="w-3 h-3 text-white"
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            <span className="text-gray-800 text-base">{opt.option_text}</span>
          </label>
        );
      })}
      {error && (
        <p className="text-sm text-red-600 mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function FreeText({
  question,
  value,
  onChange,
  error,
}: {
  question: SnapshotQuestion;
  value: string;
  onChange: (text: string) => void;
  error?: string;
}) {
  const textareaId = `q-${question.id}`;
  const errorId = `${textareaId}-error`;
  return (
    <div>
      <textarea
        id={textareaId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-required={question.required}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        rows={5}
        className="w-full rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none p-4 text-base text-gray-800 resize-none transition-colors bg-white"
        placeholder="Type your answer here…"
      />
      {error && (
        <p id={errorId} className="text-sm text-red-600 mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SurveyClient({
  slug,
  snapshot,
  initialResponses,
  initialSubmitted,
}: Props) {
  const questions = snapshot.questions;
  const [answers, setAnswers] = useState<AnswerMap>(() =>
    buildInitialAnswers(initialResponses),
  );
  const [currentIndex, setCurrentIndex] = useState(() =>
    getResumeIndex(questions, buildInitialAnswers(initialResponses)),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(initialSubmitted);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const answersRef = useRef(answers);
  const inflightRef = useRef(0);
  // Guards against React Strict Mode's intentional double-mount in development
  const openedFiredRef = useRef(false);

  // Keep answersRef current so callbacks can read latest state without stale closures
  useEffect(() => {
    answersRef.current = answers;
  });

  // Fire opened event once per genuine page load (client-side only, avoids SSR dupe).
  // The ref guard prevents React Strict Mode's development double-mount from firing twice.
  // On a genuine reload/revisit the component remounts fresh and the ref resets to false.
  useEffect(() => {
    if (isSubmitted) return;
    if (openedFiredRef.current) return;
    openedFiredRef.current = true;
    fetch("/api/opened", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    }).catch((e) => console.error("[survey] opened event failed", e));
  }, [slug, isSubmitted]);

  // ── Save ──────────────────────────────────────────────────────────────────

  const saveResponse = useCallback(
    async (questionId: string, state: AnswerState): Promise<boolean> => {
      inflightRef.current++;
      setIsSaving(true);
      setSaveError(null);
      try {
        const res = await fetch("/api/response", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            question_id: questionId,
            answer_text: state.text ?? null,
            answer_values: state.values ?? null,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          setSaveError(err.error ?? "Failed to save. Please try again.");
          return false;
        }
        setSaveError(null);
        return true;
      } catch {
        setSaveError("Network error. Please check your connection.");
        return false;
      } finally {
        inflightRef.current--;
        if (inflightRef.current === 0) setIsSaving(false);
      }
    },
    [slug],
  );

  // ── Free text debounce ────────────────────────────────────────────────────

  const handleTextChange = useCallback(
    (questionId: string, text: string) => {
      setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], text } }));
      clearTimeout(debounceRef.current[questionId]);
      debounceRef.current[questionId] = setTimeout(() => {
        saveResponse(questionId, { text });
      }, 800);
    },
    [saveResponse],
  );

  const flushText = useCallback(
    async (questionId: string): Promise<boolean> => {
      if (debounceRef.current[questionId]) {
        clearTimeout(debounceRef.current[questionId]);
        delete debounceRef.current[questionId];
        const state = answersRef.current[questionId];
        if (state?.text !== undefined) {
          return saveResponse(questionId, { text: state.text });
        }
      }
      return true;
    },
    [saveResponse],
  );

  // Flushes any pending debounced save for the current question regardless of type.
  // Critical for Submit and Next on select questions with pending 300ms debounces.
  const flushCurrentQuestion = useCallback(
    async (q: SnapshotQuestion): Promise<boolean> => {
      if (q.answer_type === "free_text") {
        return flushText(q.id);
      }
      // Flush pending multi-select (or single-select) debounce
      const msKey = `ms-${q.id}`;
      if (debounceRef.current[msKey]) {
        clearTimeout(debounceRef.current[msKey]);
        delete debounceRef.current[msKey];
        const state = answersRef.current[q.id];
        if (state?.values !== undefined) {
          return saveResponse(q.id, { values: state.values });
        }
      }
      return true;
    },
    [flushText, saveResponse],
  );

  // ── Select handlers ───────────────────────────────────────────────────────

  const handleSingleSelect = useCallback(
    (questionId: string, optionId: string) => {
      const state: AnswerState = { values: [optionId] };
      setAnswers((prev) => ({ ...prev, [questionId]: state }));
      // Clear error on selection
      setErrors((prev) => {
        const n = { ...prev };
        delete n[questionId];
        return n;
      });
      saveResponse(questionId, state);
    },
    [saveResponse],
  );

  const handleMultiSelect = useCallback(
    (questionId: string, optionId: string, checked: boolean) => {
      setAnswers((prev) => {
        const current = prev[questionId]?.values ?? [];
        const updated = checked
          ? [...current, optionId]
          : current.filter((v) => v !== optionId);
        const state: AnswerState = { values: updated };
        // Debounce multi-select saves slightly to batch rapid toggles
        clearTimeout(debounceRef.current[`ms-${questionId}`]);
        debounceRef.current[`ms-${questionId}`] = setTimeout(() => {
          saveResponse(questionId, state);
        }, 300);
        return { ...prev, [questionId]: state };
      });
      setErrors((prev) => {
        const n = { ...prev };
        delete n[questionId];
        return n;
      });
    },
    [saveResponse],
  );

  // ── Navigation ────────────────────────────────────────────────────────────

  const clearQuestionError = (questionId: string) => {
    setErrors((prev) => {
      const n = { ...prev };
      delete n[questionId];
      return n;
    });
  };

  const handleNext = useCallback(async () => {
    const q = questions[currentIndex];

    // Flush any pending save (free_text debounce or select debounce) before moving
    const saved = await flushCurrentQuestion(q);
    if (!saved && q.required) {
      setErrors((prev) => ({
        ...prev,
        [q.id]: "Answer could not be saved. Please try again.",
      }));
      return;
    }

    // Required validation
    if (q.required && !hasValidAnswer(q, answersRef.current[q.id])) {
      setErrors((prev) => ({ ...prev, [q.id]: "This question is required." }));
      return;
    }

    clearQuestionError(q.id);
    setCurrentIndex((i) => Math.min(i + 1, questions.length - 1));
  }, [questions, currentIndex, flushCurrentQuestion]);

  const handlePrev = useCallback(async () => {
    if (currentIndex === 0) return;
    const q = questions[currentIndex];
    // Flush any pending save to avoid data loss on backwards navigation
    await flushCurrentQuestion(q);
    clearQuestionError(q.id);
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, [questions, currentIndex, flushCurrentQuestion]);

  const handleSubmit = useCallback(async () => {
    const q = questions[currentIndex];

    // Flush any pending save before submit (critical: server validates from DB, not local state)
    const saved = await flushCurrentQuestion(q);
    if (!saved && q.required) {
      setErrors((prev) => ({
        ...prev,
        [q.id]: "Answer could not be saved. Please try again.",
      }));
      return;
    }

    // Client-side required check before submit
    const missing = questions.filter(
      (question) => question.required && !hasValidAnswer(question, answersRef.current[question.id]),
    );
    if (missing.length > 0) {
      setSubmitError(
        "Please answer all required questions before submitting.",
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (res.ok) {
        setIsSubmitted(true);
      } else if (res.status === 409) {
        setIsSubmitted(true);
      } else {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setSubmitError(err.error ?? "Submission failed. Please try again.");
      }
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [questions, currentIndex, flushCurrentQuestion, slug]);

  // ── Submitted state ───────────────────────────────────────────────────────

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-xl text-center py-16">
          <svg
            className="mx-auto mb-6 w-12 h-12 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h1 className="text-2xl font-semibold text-gray-900 mb-3">
            Thank you.
          </h1>
          <p className="text-gray-500">Your responses have been recorded.</p>
        </div>
      </div>
    );
  }

  // ── Survey UI ─────────────────────────────────────────────────────────────

  const question = questions[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === questions.length - 1;
  const progressPct = Math.round(((currentIndex + 1) / questions.length) * 100);
  const currentAnswer = answers[question.id];

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="flex flex-col items-center px-4 py-8 pb-16">
        <div className="w-full max-w-xl">

          {/* Survey title */}
          <h1 className="text-lg font-semibold text-gray-900 mb-1 leading-snug">
            {snapshot.survey_title}
          </h1>

          {/* Description on first question */}
          {isFirst && snapshot.survey_description && (
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              {snapshot.survey_description}
            </p>
          )}

          {/* Progress */}
          <div className="mb-6" aria-label={`Question ${currentIndex + 1} of ${questions.length}`}>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-medium text-gray-500">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span className="text-xs text-gray-400">{progressPct}%</span>
            </div>
            <div
              className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={currentIndex + 1}
              aria-valuemin={1}
              aria-valuemax={questions.length}
            >
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Question card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">

            {/* Media */}
            <QuestionMedia question={question} />

            {/* Question text */}
            <p className="text-base font-medium text-gray-900 mb-5 leading-snug">
              {question.question_text}
              {question.required && (
                <span className="text-red-500 ml-1" aria-label="required">
                  *
                </span>
              )}
            </p>

            {/* Answer controls */}
            {question.answer_type === "single_select" && (
              <SingleSelect
                question={question}
                value={currentAnswer?.values?.[0]}
                onChange={(optId) => handleSingleSelect(question.id, optId)}
                error={errors[question.id]}
              />
            )}

            {question.answer_type === "multi_select" && (
              <MultiSelect
                question={question}
                values={currentAnswer?.values ?? []}
                onChange={(optId, checked) =>
                  handleMultiSelect(question.id, optId, checked)
                }
                error={errors[question.id]}
              />
            )}

            {question.answer_type === "free_text" && (
              <FreeText
                question={question}
                value={currentAnswer?.text ?? ""}
                onChange={(text) => handleTextChange(question.id, text)}
                error={errors[question.id]}
              />
            )}
          </div>

          {/* Save status */}
          {saveError && (
            <div
              className="mt-3 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
              role="alert"
            >
              {saveError}
              {isSaving && " Retrying…"}
            </div>
          )}
          {isSaving && !saveError && (
            <p className="mt-2 text-xs text-gray-400 text-right">Saving…</p>
          )}

          {/* Submit error */}
          {submitError && (
            <div
              className="mt-3 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
              role="alert"
            >
              {submitError}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-5 flex gap-3">
            <button
              onClick={handlePrev}
              disabled={isFirst || isSubmitting}
              className="flex-1 py-3 px-5 rounded-xl border-2 border-gray-200 text-gray-700 font-medium text-sm hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous question"
            >
              Previous
            </button>

            {isLast ? (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 px-5 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                aria-label="Submit survey"
              >
                {isSubmitting ? "Submitting…" : "Submit"}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={isSubmitting}
                className="flex-1 py-3 px-5 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                aria-label="Next question"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
