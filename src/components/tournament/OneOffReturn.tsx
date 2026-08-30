"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader } from "@/components/ui/Loader";
import { useToast } from "@/components/ui/Toast";
import { oneOffTournamentResultAction } from "@/server/actions/paymentActions";

/**
 * Landing point after a one-off checkout. The tournament is created by the
 * payment webhook, so this polls for it and sends the buyer straight there once
 * it exists, rather than dropping them back on an empty form.
 */
export function OneOffReturn() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const paymentId = params.get("created");
  const [checking, setChecking] = useState(Boolean(paymentId));

  useEffect(() => {
    if (!paymentId) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;

    const poll = () => {
      void oneOffTournamentResultAction(paymentId).then((result) => {
        if (result.ok && result.data.tournamentId) {
          toast.success("Tournament created");
          router.replace(`/tournament/${result.data.tournamentId}`);
          return;
        }
        // The webhook can lag the redirect by a moment; give it a few tries.
        tries += 1;
        if (tries >= 6) {
          setChecking(false);
          toast.error(
            "Payment received. Your tournament is being set up. Check your dashboard shortly.",
          );
          return;
        }
        timer = setTimeout(poll, 1500);
      });
    };
    poll();
    return () => clearTimeout(timer);
  }, [paymentId, router, toast]);

  if (!checking) return null;
  return (
    <div className="fixed inset-0 z-90 flex items-center justify-center bg-bg/85 backdrop-blur-sm">
      <Loader label="Finishing your tournament" />
    </div>
  );
}
