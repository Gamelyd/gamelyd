"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { HelpOverlay } from "@/components/help/HelpOverlay";
import { FALLBACK_TOUR } from "@/components/help/tours";
import {
  hasSeenHelp,
  markHelpSeen,
  visibleHelpSteps,
  type HelpStep,
  type HelpTour,
} from "@/lib/help";

type HelpContextValue = {
  register: (tour: HelpTour) => () => void;
  start: () => void;
  stop: () => void;
  setPaused: (paused: boolean) => void;
};

const HelpContext = createContext<HelpContextValue | null>(null);

export function HelpProvider({ children }: { children: ReactNode }) {
  const tourRef = useRef<HelpTour | null>(null);
  const [active, setActive] = useState<{
    id: string;
    steps: HelpStep[];
    index: number;
  } | null>(null);
  const autoTimer = useRef<number>(0);
  const pausedRef = useRef(false);

  const stop = useCallback(() => {
    setActive((current) => {
      if (current) markHelpSeen(current.id);
      return null;
    });
  }, []);

  const setPaused = useCallback((paused: boolean) => {
    pausedRef.current = paused;
    if (!paused) return;
    window.clearTimeout(autoTimer.current);
    setActive(null);
  }, []);

  const start = useCallback((opts?: { force?: boolean }) => {
    if (pausedRef.current) return;
    window.clearTimeout(autoTimer.current);
    const tour = tourRef.current ?? FALLBACK_TOUR;
    if (!opts?.force && hasSeenHelp(tour.id)) return;
    const steps = visibleHelpSteps(tour.steps);
    if (steps.length > 0) {
      setActive({ id: tour.id, steps, index: 0 });
      return;
    }
    if (!opts?.force) return;
    const fallback = visibleHelpSteps(FALLBACK_TOUR.steps);
    if (fallback.length === 0) return;
    setActive({ id: FALLBACK_TOUR.id, steps: fallback, index: 0 });
  }, []);

  const register = useCallback(
    (tour: HelpTour) => {
      tourRef.current = tour;
      window.clearTimeout(autoTimer.current);
      if (!hasSeenHelp(tour.id)) {
        let tries = 0;
        const attempt = () => {
          if (pausedRef.current) return;
          if (tourRef.current?.id !== tour.id) return;
          if (visibleHelpSteps(tour.steps).length > 0) {
            start();
            return;
          }
          tries += 1;
          if (tries < 10) {
            autoTimer.current = window.setTimeout(attempt, 280);
          }
        };
        autoTimer.current = window.setTimeout(attempt, 500);
      }
      return () => {
        window.clearTimeout(autoTimer.current);
        if (tourRef.current?.id === tour.id) tourRef.current = null;
        setActive((current) =>
          current?.id === tour.id ? null : current,
        );
      };
    },
    [start],
  );

  const next = useCallback(() => {
    setActive((current) => {
      if (!current) return null;
      if (current.index >= current.steps.length - 1) {
        markHelpSeen(current.id);
        return null;
      }
      return { ...current, index: current.index + 1 };
    });
  }, []);

  const prev = useCallback(() => {
    setActive((current) => {
      if (!current || current.index === 0) return current;
      return { ...current, index: current.index - 1 };
    });
  }, []);

  const value = useMemo(
    () => ({
      register,
      start: () => start({ force: true }),
      stop,
      setPaused,
    }),
    [register, start, stop, setPaused],
  );

  return (
    <HelpContext.Provider value={value}>
      {children}
      {active ? (
        <HelpOverlay
          steps={active.steps}
          index={active.index}
          onNext={next}
          onPrev={prev}
          onClose={stop}
        />
      ) : null}
    </HelpContext.Provider>
  );
}

export function useHelp() {
  const ctx = useContext(HelpContext);
  if (!ctx) throw new Error("useHelp must be used inside HelpProvider");
  return ctx;
}
