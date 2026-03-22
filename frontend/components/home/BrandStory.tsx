"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { HomepageStory } from "@/lib/api";

function splitParagraphs(content: string): string[] {
  const raw = String(content || "");

  // Prefer blank-line paragraphs (\n\n), but if the CMS text uses single newlines,
  // fall back to splitting by line while preserving intent.
  const byBlankLines = raw
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (byBlankLines.length > 1) return byBlankLines;

  // Fallback: treat each non-empty line as a paragraph.
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function BrandStory({ story }: { story: HomepageStory | null }) {
  const safeStory = story ?? null;
  const title = String(safeStory?.title || "").trim();
  const content = String(safeStory?.content || "").trim();
  const subtitle = String(safeStory?.subtitle || "").trim();
  const hasSomething = Boolean(title) || Boolean(content);

  const sectionRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isVisible) return;

    const el = sectionRef.current;
    if (!el) return;

    let observer: IntersectionObserver | null = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer?.disconnect();
          observer = null;
        }
      },
      {
        root: null,
        // Trigger slightly before fully visible for a smoother reveal
        rootMargin: "0px 0px -15% 0px",
        threshold: 0.15,
      }
    );

    observer.observe(el);

    return () => {
      observer?.disconnect();
      observer = null;
    };
  }, [isVisible]);

  const paragraphs = useMemo(() => splitParagraphs(content), [content]);

  // Headline with two levels (title + claim in italic).
  // If the CMS content already has 2+ paragraphs, use the first one as the claim.
  // Otherwise, fall back to the subtitle as the claim (if provided).
  const claim = useMemo(
    () => (paragraphs.length >= 2 ? paragraphs[0] : subtitle),
    [paragraphs, subtitle]
  );

  // Body paragraphs: if claim comes from content, use the rest; otherwise use content as body.
  const body = useMemo(
    () => (paragraphs.length >= 2 ? paragraphs.slice(1) : paragraphs),
    [paragraphs]
  );

  if (!safeStory || !hasSomething) return null;

  return (
    <section
      ref={sectionRef}
      className={[
        "relative mx-auto w-full max-w-5xl px-6 py-16 md:px-8 md:py-24 lg:py-28",
        "brand-story-reveal",
        isVisible ? "is-visible" : "",
      ].join(" ")}
    >
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 top-0 h-24 rounded-full bg-zinc-950/[0.03] blur-3xl md:inset-x-16"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-10 h-20 w-20 -translate-x-1/2 rounded-full border border-zinc-900/6 opacity-70 blur-[1px]"
        />
        <div className="relative space-y-14 text-center md:space-y-16">
          <header className="space-y-6 md:space-y-8">
            <h2 className="mx-auto max-w-4xl text-4xl font-extrabold leading-[1] tracking-[-0.02em] text-zinc-950 transition-[transform,filter,opacity] duration-700 ease-out md:text-7xl lg:text-8xl">
              <span className="bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-700 bg-clip-text text-transparent">
                {title}
              </span>
            </h2>

            {claim ? (
              <p className="mx-auto max-w-3xl text-lg font-medium italic leading-relaxed tracking-tight text-zinc-700/90 transition-colors duration-300 md:text-2xl lg:max-w-4xl lg:text-[1.95rem]">
                {claim}
              </p>
            ) : null}
          </header>

          <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-zinc-900/10 to-transparent" />

          <div className="mx-auto max-w-3xl space-y-6 md:max-w-4xl md:space-y-8">
            {body.map((p, idx) => (
              <p
                key={idx}
                className="text-balance text-base leading-8 text-zinc-600/90 transition-colors duration-300 md:text-lg md:leading-9"
              >
                {p}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}