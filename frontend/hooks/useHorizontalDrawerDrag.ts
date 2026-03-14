

"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
} from "react";

const MENU_DRAG_THRESHOLD_PX = 12;
const MENU_HORIZONTAL_DOMINANCE_RATIO = 1.2;
const MENU_CLOSE_THRESHOLD_RATIO = 0.32;
const MENU_FAST_SWIPE_VELOCITY = 0.55;

type UseHorizontalDrawerDragParams = {
  isOpen: boolean;
  onClose: () => void;
};

type UseHorizontalDrawerDragReturn = {
  panelRef: React.RefObject<HTMLDivElement>;
  isDragging: boolean;
  backdropOpacity: number;
  translateX: number;
  handleTouchStart: (event: TouchEvent<HTMLDivElement>) => void;
  handleTouchMove: (event: TouchEvent<HTMLDivElement>) => void;
  handleTouchEnd: () => void;
  handleTouchCancel: () => void;
  resetDragState: () => void;
};

export function useHorizontalDrawerDrag({
  isOpen,
  onClose,
}: UseHorizontalDrawerDragParams): UseHorizontalDrawerDragReturn {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartTimeRef = useRef(0);

  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [lockedAxis, setLockedAxis] = useState<"x" | "y" | null>(null);

  const panelWidth = panelRef.current?.offsetWidth ?? 0;
  const clampedDragX = Math.min(0, dragX);
  const dragDistance = Math.abs(clampedDragX);
  const dragProgress = panelWidth > 0 ? Math.min(dragDistance / panelWidth, 1) : 0;

  const backdropOpacity = isOpen ? Math.max(0, 1 - dragProgress) : 0;
  const translateX = isOpen ? (isDragging ? clampedDragX : 0) : -(panelWidth || 0);

  const resetDragState = useCallback(() => {
    setIsDragging(false);
    setDragX(0);
    setStartX(0);
    setStartY(0);
    setLockedAxis(null);
    dragStartTimeRef.current = 0;
  }, []);

  const handleTouchStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (!isOpen) return;

      const interactiveTarget = (event.target as HTMLElement | null)?.closest(
        'a, button, input, select, textarea, [role="button"]'
      );

      if (interactiveTarget) {
        resetDragState();
        return;
      }

      const touch = event.touches[0];

      setStartX(touch.clientX);
      setStartY(touch.clientY);
      setDragX(0);
      setLockedAxis(null);
      setIsDragging(false);

      dragStartTimeRef.current = performance.now();
    },
    [isOpen, resetDragState]
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (!isOpen) return;

      const touch = event.touches[0];

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      if (!lockedAxis) {
        if (absDeltaX < MENU_DRAG_THRESHOLD_PX && absDeltaY < MENU_DRAG_THRESHOLD_PX) {
          return;
        }

        if (absDeltaX > absDeltaY * MENU_HORIZONTAL_DOMINANCE_RATIO && deltaX < 0) {
          setLockedAxis("x");
          setIsDragging(true);
        } else {
          setLockedAxis("y");
          setIsDragging(false);
          return;
        }
      }

      if (lockedAxis !== "x") return;

      event.preventDefault();

      setIsDragging(true);
      setDragX(Math.min(0, deltaX));
    },
    [isOpen, lockedAxis, startX, startY]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isOpen) {
      resetDragState();
      return;
    }

    if (lockedAxis !== "x") {
      resetDragState();
      return;
    }

    const elapsedMs = Math.max(performance.now() - dragStartTimeRef.current, 1);
    const velocity = dragDistance / elapsedMs;

    const shouldCloseByDistance =
      panelWidth > 0 && dragDistance > panelWidth * MENU_CLOSE_THRESHOLD_RATIO;

    const shouldCloseByVelocity = velocity > MENU_FAST_SWIPE_VELOCITY;

    if (shouldCloseByDistance || shouldCloseByVelocity) {
      resetDragState();
      onClose();
      return;
    }

    resetDragState();
  }, [dragDistance, isOpen, lockedAxis, onClose, panelWidth, resetDragState]);

  const handleTouchCancel = useCallback(() => {
    resetDragState();
  }, [resetDragState]);

  return useMemo(
    () => ({
      panelRef,
      isDragging,
      backdropOpacity,
      translateX,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      handleTouchCancel,
      resetDragState,
    }),
    [
      backdropOpacity,
      handleTouchCancel,
      handleTouchEnd,
      handleTouchMove,
      handleTouchStart,
      isDragging,
      resetDragState,
      translateX,
    ]
  );
}