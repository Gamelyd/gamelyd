"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { findHelpTarget, type HelpStep } from "@/lib/help";

const PAD = 8;
const GUTTER = 12;
const MOBILE_MAX = 640;

type Box = { top: number; left: number; width: number; height: number };

function viewportSize() {
  const vv = window.visualViewport;
  return {
    w: Math.round(vv?.width ?? window.innerWidth),
    h: Math.round(vv?.height ?? window.innerHeight),
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function holeFromRect(rect: DOMRect, vp: { w: number; h: number }, sheet: boolean): Box {
  const reserve = sheet ? Math.min(280, vp.h * 0.42) : 0;
  const maxH = Math.max(48, vp.h - reserve - GUTTER * 2);
  const width = clamp(rect.width + PAD * 2, 40, vp.w - GUTTER * 2);
  const height = clamp(rect.height + PAD * 2, 40, maxH);
  const left = clamp(rect.left - PAD, GUTTER, vp.w - width - GUTTER);
  const top = clamp(rect.top - PAD, GUTTER, vp.h - reserve - height - GUTTER);
  return { top, left, width, height };
}

function cardPosition(
  hole: Box,
  vp: { w: number; h: number },
  cardW: number,
  cardH: number,
): { top: number; left: number } {
  const spaceBelow = vp.h - (hole.top + hole.height);
  const spaceAbove = hole.top;
  const placeBelow = spaceBelow >= cardH + 16 || spaceAbove < cardH + 16;
  const top = placeBelow
    ? clamp(hole.top + hole.height + 12, GUTTER, vp.h - cardH - GUTTER)
    : clamp(hole.top - cardH - 12, GUTTER, vp.h - cardH - GUTTER);
  const left = clamp(hole.left, GUTTER, vp.w - cardW - GUTTER);
  return { top, left };
}

export function HelpOverlay({
  steps,
  index,
  onNext,
  onPrev,
  onClose,
}: {
  steps: HelpStep[];
  index: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [vp, setVp] = useState({ w: 1024, h: 768 });
  const step = steps[index];
  const last = index >= steps.length - 1;

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!step) return;
    const previous = document.body.style.overflow;
    const measure = () => {
      setVp(viewportSize());
      if (!step.target) {
        setRect(null);
        return;
      }
      const el = findHelpTarget(step.target);
      if (!el) {
        setRect(null);
        return;
      }
      el.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
      setRect(el.getBoundingClientRect());
    };

    document.body.style.overflow = "";
    measure();
    const frame = window.requestAnimationFrame(() => {
      measure();
      document.body.style.overflow = "hidden";
    });

    const vv = window.visualViewport;
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    vv?.addEventListener("resize", measure);
    vv?.addEventListener("scroll", measure);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previous;
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      vv?.removeEventListener("resize", measure);
      vv?.removeEventListener("scroll", measure);
    };
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNext, onPrev]);

  if (!mounted || !step) return null;

  const sheet = vp.w < MOBILE_MAX;
  const hole = rect ? holeFromRect(rect, vp, sheet) : null;
  const cardW = Math.min(360, vp.w - GUTTER * 2);
  const cardH = 240;
  const desktopPos =
    hole && !sheet ? cardPosition(hole, vp, cardW, cardH) : null;

  return createPortal(
    <div
      className="fixed inset-0 z-300 touch-manipulation"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-tour-title"
    >
      <div className="absolute inset-0" onClick={onClose} />
      {hole ? (
        <div
          className="pointer-events-none absolute rounded-xl border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.72)]"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
          }}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-black/72" />
      )}
      <div
        className={
          sheet
            ? "absolute inset-x-3 z-1 mx-auto w-auto max-w-md rounded-2xl border border-primary/30 bg-surface p-4 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.9)]"
            : "absolute z-1 w-[min(22.5rem,calc(100vw-1.5rem))] max-w-md rounded-2xl border border-primary/30 bg-surface p-4 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.9)]"
        }
        style={
          sheet
            ? {
                bottom: "max(0.75rem, env(safe-area-inset-bottom))",
                maxHeight: "min(42vh, 22rem)",
                overflowY: "auto",
              }
            : desktopPos
              ? { top: desktopPos.top, left: desktopPos.left }
              : {
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }
        }
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
          {index + 1} / {steps.length}
        </p>
        <h3
          id="help-tour-title"
          className="mt-1 font-display text-xl text-white"
        >
          {step.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-body">{step.body}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="min-h-11 px-2 text-sm text-body hover:text-white"
            onClick={onClose}
          >
            Skip
          </button>
          <div className="flex gap-2">
            {index > 0 ? (
              <Button
                type="button"
                variant="dark"
                className="min-h-11"
                onClick={onPrev}
              >
                Back
              </Button>
            ) : null}
            <Button type="button" className="min-h-11 min-w-22" onClick={onNext}>
              {last ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
