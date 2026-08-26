"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHeader } from "@/components/layout/PageHeader";
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
import {
  placeLabel,
  type PrizePosition,
  type SaveTournamentInput,
} from "@/lib/schemas/tournament";
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
  {
    key: "Payment",
    title: "Payment",
    options: [
      "FREE",
      // "PAID",
      "SPONSORED",
    ],
  },
  {
    key: "TournamentMode",
    title: "Mode",
    options: ["MULTIPLAYER", "BATTLEROYALE", "GROUPS", "LEAGUE"],
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
  const [returnLeg, setReturnLeg] = useState(false);
  const [advancePerGroup, setAdvancePerGroup] = useState(2);
  const [prizes, setPrizes] = useState<PrizePosition[]>([
    { Position: 1, Amount: 0 },
    { Position: 2, Amount: 0 },
    { Position: 3, Amount: 0 },
  ]);

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
      Amount:
        choices.Payment === "SPONSORED"
          ? prizes.reduce((sum, prize) => sum + (prize.Amount || 0), 0)
          : details.Amount,
      RegistrationAmount:
        choices.Payment === "PAID" ? details.RegistrationAmount : 0,
      Prizes: choices.Payment === "SPONSORED" ? prizes : [],
      Link: "",
      RefNumber: "",
      PaymentChannel: "",
      OrgId: orgId,
      ReturnLeg: choices.TournamentMode === "LEAGUE" ? returnLeg : false,
      AdvancePerGroup:
        choices.TournamentMode === "GROUPS" ? advancePerGroup : 2,
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
      <PageHeader
        kicker="Host"
        title="Create a tournament"
        description={`Step ${step === "choices" ? "1" : "2"} of 2`}
        width="max-w-4xl"
      />

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
                {group.key === "TournamentMode" &&
                  choices.TournamentMode === "LEAGUE" && (
                    <div className="mt-6">
                      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">
                        Return leg
                      </h3>
                      <p className="mb-3 text-sm text-body">
                        Play each pairing once, or again with sides swapped.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {[
                          { label: "NO", value: false },
                          { label: "YES", value: true },
                        ].map((opt) => {
                          const active = returnLeg === opt.value;
                          return (
                            <button
                              key={opt.label}
                              type="button"
                              onClick={() => setReturnLeg(opt.value)}
                              className={`rounded-xl border px-5 py-3 text-sm font-medium transition-colors ${
                                active
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-surface-2 bg-surface text-body hover:border-primary/40"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                {group.key === "TournamentMode" &&
                  choices.TournamentMode === "GROUPS" && (
                    <div className="mt-6 max-w-xs">
                      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">
                        Teams advancing per group
                      </h3>
                      <p className="mb-3 text-sm text-body">
                        How many teams from each group go through to knockout.
                        This can&apos;t be changed later.
                      </p>
                      <Input
                        type="number"
                        min={1}
                        max={8}
                        value={advancePerGroup}
                        onChange={(e) =>
                          setAdvancePerGroup(
                            Math.min(8, Math.max(1, Number(e.target.value) || 1)),
                          )
                        }
                      />
                    </div>
                  )}
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

            {/* Paid registration/prize fields are hidden for now.
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
            */}

            {choices.Payment === "SPONSORED" && (
              <div className="rounded-xl border border-surface-2 bg-surface p-5">
                <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-white">
                  Prize positions
                </h3>
                <p className="mb-4 text-sm text-body">
                  Amount for each finishing place (₦).
                </p>
                <div className="flex flex-col gap-3">
                  {prizes.map((prize, index) => (
                    <div key={prize.Position} className="grid grid-cols-[5rem_1fr_auto] gap-3">
                      <Input
                        type="number"
                        label={index === 0 ? "Place" : undefined}
                        value={prize.Position}
                        min={1}
                        onChange={(e) => {
                          const next = [...prizes];
                          next[index] = {
                            ...prize,
                            Position: Number(e.target.value) || 1,
                          };
                          setPrizes(next);
                        }}
                      />
                      <Input
                        type="number"
                        label={index === 0 ? `${placeLabel(prize.Position)} amount` : undefined}
                        value={prize.Amount}
                        min={0}
                        onChange={(e) => {
                          const next = [...prizes];
                          next[index] = {
                            ...prize,
                            Amount: Number(e.target.value) || 0,
                          };
                          setPrizes(next);
                        }}
                      />
                      {prizes.length > 1 ? (
                        <button
                          type="button"
                          className={`text-sm text-body hover:text-white ${index === 0 ? "mt-7" : ""}`}
                          onClick={() =>
                            setPrizes(prizes.filter((_, i) => i !== index))
                          }
                        >
                          Remove
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="dark"
                  className="mt-4"
                  onClick={() =>
                    setPrizes([
                      ...prizes,
                      {
                        Position:
                          Math.max(...prizes.map((p) => p.Position), 0) + 1,
                        Amount: 0,
                      },
                    ])
                  }
                >
                  Add position
                </Button>
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
