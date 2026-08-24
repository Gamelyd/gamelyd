"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { saveTournamentAction } from "@/server/actions/tournamentActions";
import { getGamesAction } from "@/server/actions/gameActions";
import { getPlatformsAction } from "@/server/actions/platformActions";
import { IconPicker } from "@/components/ui/IconPicker";
import { MultiSelect } from "@/components/ui/MultiSelect";
import {
  FALLBACKS,
  TOURNAMENT_ICONS,
  iconForGame,
} from "@/lib/icons";
import { joinPlatforms } from "@/lib/platforms";
import type { Game } from "@/lib/schemas/game";
import type { Platform } from "@/lib/schemas/platform";
import type { SaveTournamentInput } from "@/lib/schemas/tournament";
import type {
  Payment,
  Shuffle,
  TeamSize,
  TournamentMode,
  TournamentType,
} from "@/lib/schemas/common";

interface WizardChoices {
  TournamentType: TournamentType;
  Payment: Payment;
  TournamentMode: TournamentMode;
  Team: TeamSize;
  Shuffle: Shuffle;
}

const optionGroups: {
  key: keyof WizardChoices;
  title: string;
  options: string[];
}[] = [
  { key: "TournamentType", title: "Visibility", options: ["PUBLIC", "PRIVATE"] },
  { key: "Payment", title: "Payment", options: ["FREE", "PAID", "SPONSORED"] },
  {
    key: "TournamentMode",
    title: "Mode",
    options: ["MULTIPLAYER", "BATTLEROYALE", "GROUPS"],
  },
  { key: "Team", title: "Team size", options: ["SINGLE", "DUO", "SQUAD"] },
  { key: "Shuffle", title: "Draw", options: ["MANUAL", "AUTOMATIC"] },
];

export default function CreateTournamentPage() {
  const { isAuthenticated, orgs, user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<"choices" | "details">("choices");
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState("");
  const [gamesList, setGamesList] = useState<Game[]>([]);
  const [gamesLoaded, setGamesLoaded] = useState(false);
  const [platformList, setPlatformList] = useState<Platform[]>([]);
  const [platformsLoaded, setPlatformsLoaded] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  const [choices, setChoices] = useState<WizardChoices>({
    TournamentType: "PUBLIC",
    Payment: "FREE",
    TournamentMode: "MULTIPLAYER",
    Team: "SINGLE",
    Shuffle: "AUTOMATIC",
  });

  const [details, setDetails] = useState({
    Name: "",
    GameName: "",
    icon: TOURNAMENT_ICONS[0]?.url ?? FALLBACKS.tournament,
    TournamentSize: 8,
    Date: "",
    Note: "",
    Amount: 0,
    RegistrationAmount: 0,
  });

  useEffect(() => {
    if (!isAuthenticated) router.push("/signup?redirect=/tournament/new");
  }, [isAuthenticated, router]);

  useEffect(() => {
    let active = true;
    void getGamesAction().then((result) => {
      if (!active) return;
      if (result.ok) setGamesList(result.data);
      else toast.error(result.error);
      setGamesLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [toast]);

  useEffect(() => {
    let active = true;
    void getPlatformsAction().then((result) => {
      if (!active) return;
      if (result.ok) setPlatformList(result.data);
      else toast.error(result.error);
      setPlatformsLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.GameName) {
      toast.error("Select a game");
      return;
    }
    setLoading(true);
    const payload: SaveTournamentInput = {
      ...choices,
      Name: details.Name,
      GameName: details.GameName,
      icon: details.icon || FALLBACKS.tournament,
      TournamentSize: details.TournamentSize,
      Date: details.Date,
      Note: details.Note,
      Platform: joinPlatforms(selectedPlatforms),
      Amount: details.Amount,
      RegistrationAmount: details.RegistrationAmount,
      Link: "",
      RefNumber: "",
      PaymentChannel: "",
      OrgId: orgId,
    };
    const result = await saveTournamentAction(payload);
    setLoading(false);
    if (result.ok) {
      toast.success(result.message ?? "Tournament created");
      router.push(`/tournament/${result.data.TournamentId}`);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <SiteLayout>
      <section className="gradient-brand-page">
        <div className="mx-auto max-w-4xl px-5 py-12">
          <h1 className="font-display text-4xl text-white md:text-5xl">
            Create a tournament
          </h1>
          <p className="mt-2 text-white/80">
            Step {step === "choices" ? "1" : "2"} of 2
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-12">
        {step === "choices" ? (
          <div className="flex flex-col gap-8">
            {optionGroups.map((group) => (
              <div key={group.key}>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">
                  {group.title}
                </h3>
                <div className="flex flex-wrap gap-3">
                  {group.options.map((opt) => {
                    const active = choices[group.key] === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          setChoices((prev) => ({
                            ...prev,
                            [group.key]: opt,
                          }) as WizardChoices)
                        }
                        className={`rounded-xl border px-5 py-3 text-sm font-medium transition-colors ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-surface-2 bg-surface text-body hover:border-primary/40"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div>
              <Button onClick={() => setStep("details")}>Continue</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {orgs.length > 0 ? (
              <Select
                label="Host as"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                options={[
                  { label: "Yourself", value: "" },
                  ...orgs.map((o) => ({ label: o.name, value: o.org_id })),
                ]}
              />
            ) : (
              <p className="text-sm text-body">
                Hosting as yourself.{" "}
                <Link href="/org/new" className="text-primary hover:underline">
                  Create an organization
                </Link>{" "}
                to host under a brand.
              </p>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Tournament name"
                value={details.Name}
                onChange={(e) =>
                  setDetails({ ...details, Name: e.target.value })
                }
                required
              />
              <div>
                <Select
                  label="Game name"
                  value={details.GameName}
                  onChange={(e) => {
                    const game = gamesList.find(
                      (g) => g.name === e.target.value,
                    );
                    const catalog = new Set(platformList.map((p) => p.name));
                    const fromGame = (game?.platforms ?? []).filter((name) =>
                      catalog.has(name),
                    );
                    setDetails({
                      ...details,
                      GameName: e.target.value,
                      icon:
                        game?.image ||
                        iconForGame(e.target.value) ||
                        details.icon,
                    });
                    if (fromGame.length > 0) setSelectedPlatforms(fromGame);
                  }}
                  options={[
                    {
                      label: gamesLoaded
                        ? gamesList.length > 0
                          ? "Select a game"
                          : "No games yet"
                        : "Loading games…",
                      value: "",
                    },
                    ...gamesList.map((g) => ({
                      label: g.name,
                      value: g.name,
                    })),
                  ]}
                  required
                  disabled={!gamesLoaded || gamesList.length === 0}
                />
                {gamesLoaded && gamesList.length === 0 && (
                  <p className="mt-1.5 text-xs text-body">
                    Add games in Admin → Games
                    {user?.user_type === "ADMIN" ? (
                      <>
                        {": "}
                        <Link
                          href="/admin/games"
                          className="text-primary hover:underline"
                        >
                          open games
                        </Link>
                      </>
                    ) : null}
                    . Game name is chosen from that list.
                  </p>
                )}
              </div>
            </div>
            <IconPicker
              label="Tournament icon"
              icons={TOURNAMENT_ICONS}
              value={details.icon}
              onChange={(url) => setDetails({ ...details, icon: url })}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                type="number"
                label="Size (teams)"
                value={details.TournamentSize}
                onChange={(e) =>
                  setDetails({
                    ...details,
                    TournamentSize: Number(e.target.value),
                  })
                }
                min={2}
                required
              />
              <Input
                type="date"
                label="Date"
                value={details.Date}
                onChange={(e) =>
                  setDetails({ ...details, Date: e.target.value })
                }
                required
              />
            </div>
            <div>
              <MultiSelect
                label="Platforms"
                options={platformList.map((p) => ({
                  label: p.name,
                  value: p.name,
                }))}
                value={selectedPlatforms}
                onChange={setSelectedPlatforms}
                disabled={!platformsLoaded || platformList.length === 0}
                hint={
                  platformsLoaded && platformList.length === 0
                    ? user?.user_type === "ADMIN"
                      ? "Add platforms in Admin → Platforms first."
                      : "Ask an admin to add platforms."
                    : "Select every platform this tournament supports."
                }
              />
              {platformsLoaded &&
              platformList.length === 0 &&
              user?.user_type === "ADMIN" ? (
                <p className="mt-1.5 text-xs text-body">
                  <Link
                    href="/admin/platforms"
                    className="text-primary hover:underline"
                  >
                    Open platforms
                  </Link>
                </p>
              ) : null}
            </div>

            {choices.Payment === "PAID" && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Input
                  type="number"
                  label="Registration fee (₦)"
                  value={details.RegistrationAmount}
                  onChange={(e) =>
                    setDetails({
                      ...details,
                      RegistrationAmount: Number(e.target.value),
                    })
                  }
                />
                <Input
                  type="number"
                  label="Prize pool (₦)"
                  value={details.Amount}
                  onChange={(e) =>
                    setDetails({ ...details, Amount: Number(e.target.value) })
                  }
                />
              </div>
            )}

            <TextArea
              label="Description / rules"
              rows={4}
              value={details.Note}
              onChange={(e) => setDetails({ ...details, Note: e.target.value })}
              required
            />

            <div className="flex gap-3">
              <Button
                type="button"
                variant="dark"
                onClick={() => setStep("choices")}
              >
                Back
              </Button>
              <Button type="submit" loading={loading}>
                Create tournament
              </Button>
            </div>
          </form>
        )}
      </section>
    </SiteLayout>
  );
}
