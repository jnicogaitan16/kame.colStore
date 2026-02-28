"use client";

import { useEffect, useState } from "react";
import PremiumLoader from "./PremiumLoader";

type Props = {
  delayMs?: number; // umbral antes de mostrar
};

export default function DelayedLoader({
  delayMs = 300,
}: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShow(true);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [delayMs]);

  if (!show) return null;
  return <PremiumLoader />;
}