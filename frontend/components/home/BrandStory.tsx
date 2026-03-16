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
        <div className="space-y-12 text-center md:space-y-14">
          <header className="space-y-6 md:space-y-8">
            <h2 className="mx-auto max-w-4xl text-5xl font-extrabold leading-[0.98] tracking-[-0.03em] text-white md:text-7xl lg:text-8xl">
              {title}
            </h2>

            {claim ? (
              <p className="mx-auto max-w-3xl text-xl font-semibold italic leading-relaxed tracking-tight text-white/90 md:text-3xl lg:max-w-4xl">
                {claim}
              </p>
            ) : null}
          </header>

          <div className="mx-auto h-px w-24 bg-white/10" />

          <div className="mx-auto max-w-3xl space-y-6 md:max-w-4xl md:space-y-8">
            {body.map((p, idx) => (
              <p
                key={idx}
                className="text-balance text-base leading-8 text-white/72 md:text-lg md:leading-9"
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