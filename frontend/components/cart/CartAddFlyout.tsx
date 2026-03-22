

"use client";

import { useEffect, useRef, useState } from "react";

type RectLike = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type CartFlyEventDetail = {
  imageUrl: string | null;
  productId?: number | string | null;
  variantId?: number | string | null;
  sourceRect?: RectLike | null;
};

type FlightItem = {
  id: number;
  imageUrl: string | null;
  fromRect: RectLike;
  toRect: RectLike;
};

type CartAddFlyoutProps = {
  targetSelector?: string;
};

const DEFAULT_TARGET_SELECTOR = '[data-cart-target="true"]';
const FLIGHT_DURATION_MS = 520;

function isValidRect(rect: RectLike | null | undefined): rect is RectLike {
  return Boolean(
    rect &&
      Number.isFinite(rect.top) &&
      Number.isFinite(rect.left) &&
      Number.isFinite(rect.width) &&
      Number.isFinite(rect.height) &&
      rect.width > 0 &&
      rect.height > 0
  );
}

function getTargetRect(targetSelector: string): RectLike | null {
  const target = document.querySelector<HTMLElement>(targetSelector);
  if (!target) return null;

  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

export default function CartAddFlyout({
  targetSelector = DEFAULT_TARGET_SELECTOR,
}: CartAddFlyoutProps) {
  const [flights, setFlights] = useState<FlightItem[]>([]);
  const nextFlightIdRef = useRef(1);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    function handleCartFly(event: Event) {
      const customEvent = event as CustomEvent<CartFlyEventDetail>;
      const detail = customEvent.detail;
      const fromRect = detail?.sourceRect;
      const toRect = getTargetRect(targetSelector);

      if (!isValidRect(fromRect) || !isValidRect(toRect)) return;

      const id = nextFlightIdRef.current++;

      setFlights((current) => [
        ...current,
        {
          id,
          imageUrl: detail?.imageUrl ?? null,
          fromRect,
          toRect,
        },
      ]);

      const timeoutId = window.setTimeout(() => {
        setFlights((current) => current.filter((flight) => flight.id !== id));
        timeoutsRef.current = timeoutsRef.current.filter((value) => value !== timeoutId);
      }, FLIGHT_DURATION_MS + 40);

      timeoutsRef.current.push(timeoutId);
    }

    window.addEventListener("cart:fly-to-cart", handleCartFly as EventListener);

    return () => {
      window.removeEventListener("cart:fly-to-cart", handleCartFly as EventListener);
      timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutsRef.current = [];
    };
  }, [targetSelector]);

  if (flights.length === 0) return null;

  return (
    <div className="cart-fly-layer" aria-hidden="true">
      {flights.map((flight) => {
        const startX = flight.fromRect.left + flight.fromRect.width / 2 - 24;
        const startY = flight.fromRect.top + flight.fromRect.height / 2 - 24;
        const endX = flight.toRect.left + flight.toRect.width / 2 - 24;
        const endY = flight.toRect.top + flight.toRect.height / 2 - 24;

        return (
          <div
            key={flight.id}
            className="cart-fly-bubble"
            style={{
              ["--cart-fly-start-x" as string]: `${startX}px`,
              ["--cart-fly-start-y" as string]: `${startY}px`,
              ["--cart-fly-x" as string]: `${endX - startX}px`,
              ["--cart-fly-y" as string]: `${endY - startY}px`,
            }}
          >
            {flight.imageUrl ? (
              <img
                src={flight.imageUrl}
                alt=""
                className="cart-fly-bubble-image"
                draggable={false}
              />
            ) : (
              <div className="cart-fly-bubble-fallback" />
            )}
          </div>
        );
      })}
    </div>
  );
}