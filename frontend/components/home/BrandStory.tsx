"use client";

import { useEffect, useRef, useState } from "react";
import type { HomepageStory } from "@/lib/api";

function splitParagraphs(content: string): string[] {
  return String(content || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
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
        "relative mx-auto max-w-6xl px-6 py-20 md:py-28",
        "brand-story-reveal",
        isVisible ? "is-visible" : "",
      ].join(" ")}
    >
      <div className="mx-auto rounded-3xl border border-white/10 bg-black/45 backdrop-blur-md px-6 py-12 md:px-12 md:py-16">
        <div className="space-y-8 text-center">
          <header className="space-y-5">
            <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.05]">
              {story.title}
            </h2>

            {claim ? (
              <p className="mx-auto max-w-[38ch] md:max-w-[55ch] text-lg md:text-2xl font-bold italic tracking-tight text-white/85 leading-snug">
                {claim}
              </p>
            ) : null}
          </header>

          <div className="mx-auto h-px w-16 bg-white/15" />

          <div className="space-y-5">
            {(body.length ? body.slice(0, 2) : []).map((p, idx) => (
              <p
                key={idx}
                className="mx-auto max-w-[38ch] md:max-w-[55ch] text-base md:text-lg leading-relaxed text-white/70"
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