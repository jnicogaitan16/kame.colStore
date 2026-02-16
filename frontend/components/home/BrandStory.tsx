"use client";

import { useEffect, useRef, useState } from "react";
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
  if (!story) return null;

  const sectionRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || isVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
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
    return () => observer.disconnect();
  }, [isVisible]);

  const paragraphs = splitParagraphs(story.content);

  // Headline with two levels (title + claim in italic).
  // If the CMS content already has 2+ paragraphs, use the first one as the claim.
  // Otherwise, fall back to the subtitle as the claim (if provided).
  const claim = paragraphs.length >= 2 ? paragraphs[0] : story.subtitle || "";

  // Body paragraphs: if claim comes from content, use the rest; otherwise use content as body.
  const body = paragraphs.length >= 2 ? paragraphs.slice(1) : paragraphs;

  return (
    <section
      ref={sectionRef}
      className={[
        "relative mx-auto max-w-6xl px-6",
        "brand-story-reveal",
        isVisible ? "is-visible" : "",
      ].join(" ")}
    >
      <div className="mx-auto relative overflow-hidden rounded-3xl border border-white/10 bg-black/60 backdrop-blur-md px-6 py-12 md:px-12 md:py-16 shadow-[0_20px_70px_rgba(0,0,0,0.55)]">
        {/* Subtle premium background layers */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(1000px 520px at 50% -10%, rgba(255,255,255,0.06), transparent 55%), radial-gradient(800px 420px at 20% 25%, rgba(255,255,255,0.04), transparent 60%), radial-gradient(900px 520px at 80% 65%, rgba(255,255,255,0.03), transparent 62%), linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.00) 55%, rgba(0,0,0,0.18))",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), rgba(255,255,255,0.10), transparent)",
          }}
        />

        <div className="relative">
          <div className="space-y-8 text-center">
            <header className="space-y-5">
              <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.05] drop-shadow-[0_2px_18px_rgba(0,0,0,0.65)]">
                {story.title}
              </h2>

              {claim ? (
                <p className="mx-auto max-w-[40ch] md:max-w-[60ch] text-lg md:text-2xl font-bold italic tracking-tight text-white/90 leading-snug">
                  {claim}
                </p>
              ) : null}
            </header>

            <div className="mx-auto h-px w-16 bg-white/12" />

            <div className="space-y-5">
              {body.map((p, idx) => (
                <p
                  key={idx}
                  className="mx-auto max-w-[40ch] md:max-w-[60ch] text-base md:text-lg leading-relaxed text-white/75"
                >
                  {p}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}