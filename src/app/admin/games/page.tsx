"use client";

import { CatalogImage } from "@/components/ui/CatalogImage";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { RowMenu } from "@/components/ui/RowMenu";
import { Modal } from "@/components/ui/Modal";
import { Confirm } from "@/components/ui/Confirm";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import type { Game, CatalogFormat, ScoreLabel } from "@/lib/schemas/game";
import type { CatalogKind } from "@/lib/schemas/catalogKind";
import type { Platform } from "@/lib/schemas/platform";
import { IconPicker } from "@/components/ui/IconPicker";
import { Loader } from "@/components/ui/Loader";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import { useIcons } from "@/hooks/useIcons";
import {
  BASKETBALL_PRESET,
  FOOTBALL_PRESET,
  GAMES_KIND,
  kindUses,
} from "@/lib/catalog";
import {
  adminListGamesAction,
  createGameAction,
  deleteGameAction,
  toggleGameActiveAction,
  updateGameAction,
} from "@/server/actions/gameActions";
import {
  createCatalogKindAction,
  deleteCatalogKindAction,
  getCatalogKindsAction,
} from "@/server/actions/catalogKindActions";
import { getPlatformsAction } from "@/server/actions/platformActions";

interface FormState {
  name: string;
  image: string;
  platforms: string[];
  kind: string;
  formats: CatalogFormat[];
  allowDraw: boolean;
  scoreLabel: ScoreLabel;
  active: boolean;
}

const emptyForm: FormState = {
  name: "",
  image: "",
  platforms: [],
  kind: GAMES_KIND,
  formats: [],
  allowDraw: true,
  scoreLabel: "Goals",
  active: true,
};

export default function AdminGamesPage() {
  const toast = useToast();
  const [gamesList, setGamesList] = useState<Game[]>([]);
  const [kinds, setKinds] = useState<CatalogKind[]>([]);
  const [platformList, setPlatformList] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Game | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Game | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("ALL");
  const [kindForm, setKindForm] = useState({
    label: "",
    slug: "",
    usesPlatforms: false,
    usesBattleRoyale: false,
    usesInGameName: false,
    usesVenue: false,
  });
  const [kindSaving, setKindSaving] = useState(false);
  const [kindDelete, setKindDelete] = useState<CatalogKind | null>(null);
  const { icons: covers, loading: coversLoading } = useIcons("tournament");

  useEffect(() => {
    let activeReq = true;
    void Promise.all([
      adminListGamesAction(),
      getCatalogKindsAction(),
      getPlatformsAction(),
    ]).then(([gamesResult, kindsResult, platformsResult]) => {
      if (!activeReq) return;
      if (gamesResult.ok) setGamesList(gamesResult.data);
      else toast.error(gamesResult.error);
      if (kindsResult.ok) setKinds(kindsResult.data);
      else toast.error(kindsResult.error);
      if (platformsResult.ok) setPlatformList(platformsResult.data);
      else toast.error(platformsResult.error);
      setLoading(false);
    });
    return () => {
      activeReq = false;
    };
  }, [reload, toast]);

  const refresh = () => setReload((r) => r + 1);
  const flags = kindUses(kinds, form.kind);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (game: Game) => {
    setEditing(game);
    setForm({
      name: game.name,
      image: game.image,
      platforms: game.platforms,
      kind: game.kind || GAMES_KIND,
      formats: game.formats ?? [],
      allowDraw: game.allowDraw !== false,
      scoreLabel: game.scoreLabel === "Points" ? "Points" : "Goals",
      active: game.active,
    });
    setModalOpen(true);
  };

  const applyPreset = (preset: typeof FOOTBALL_PRESET) => {
    setForm((prev) => ({
      ...prev,
      name: prev.name || preset.name,
      kind: preset.kind,
      formats: preset.formats.map((row) => ({ ...row })),
      allowDraw: preset.allowDraw,
      scoreLabel: preset.scoreLabel,
      platforms: [],
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const uses = kindUses(kinds, form.kind);
    const payload = {
      name: form.name,
      image: form.image,
      platforms: uses.usesPlatforms ? form.platforms : [],
      kind: form.kind,
      formats: form.formats.filter((row) => row.label.trim() && row.roster > 0),
      allowDraw: form.allowDraw,
      scoreLabel: form.scoreLabel,
      active: form.active,
    };
    const result = editing
      ? await updateGameAction(editing.game_id, payload)
      : await createGameAction(payload);
    setSaving(false);
    if (result.ok) {
      toast.success(result.message ?? "Saved");
      setModalOpen(false);
      refresh();
    } else {
      toast.error(result.error);
    }
  };

  const toggleActive = async (game: Game) => {
    const result = await toggleGameActiveAction(game.game_id);
    if (result.ok) {
      toast.success(result.message ?? "Updated");
      refresh();
    } else {
      toast.error(result.error);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteGameAction(deleteTarget.game_id);
    setDeleting(false);
    if (result.ok) {
      toast.success(result.message ?? "Deleted");
      setDeleteTarget(null);
      refresh();
    } else {
      toast.error(result.error);
    }
  };

  const addKind = async (e: React.FormEvent) => {
    e.preventDefault();
    setKindSaving(true);
    const slug =
      kindForm.slug.trim() ||
      kindForm.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const result = await createCatalogKindAction({
      ...kindForm,
      slug,
    });
    setKindSaving(false);
    if (result.ok) {
      toast.success(result.message ?? "Kind created");
      setKindForm({
        label: "",
        slug: "",
        usesPlatforms: false,
        usesBattleRoyale: false,
        usesInGameName: false,
        usesVenue: false,
      });
      refresh();
    } else {
      toast.error(result.error);
    }
  };

  const removeKind = async () => {
    if (!kindDelete) return;
    const result = await deleteCatalogKindAction(kindDelete.slug);
    if (result.ok) {
      toast.success(result.message ?? "Deleted");
      setKindDelete(null);
      refresh();
    } else {
      toast.error(result.error);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return gamesList.filter((game) => {
      const kind = game.kind || GAMES_KIND;
      if (kindFilter !== "ALL" && kind !== kindFilter) return false;
      if (q && !game.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [gamesList, kindFilter, search]);

  const kindLabel = (slug: string) =>
    kinds.find((k) => k.slug === slug)?.label ??
    (slug === GAMES_KIND ? "Games" : slug);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-white">Catalog</h1>
        <Button onClick={openCreate}>Add item</Button>
      </div>

      <section className="mb-10 rounded-2xl border border-surface-2 bg-surface p-5">
        <h2 className="mb-1 text-lg font-semibold text-white">Kinds</h2>
        <p className="mb-4 text-sm text-body">
          Games and Sports ship by default. Add Board games or anything else
          here.
        </p>
        <ul className="mb-4 flex flex-col gap-2">
          {kinds.map((kind) => (
            <li
              key={kind.slug}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-surface-2 px-3 py-2 text-sm"
            >
              <span className="text-white">
                {kind.label}{" "}
                <span className="text-xs text-body">({kind.slug})</span>
              </span>
              <span className="text-xs text-body">
                {[
                  kind.usesPlatforms ? "platforms" : null,
                  kind.usesBattleRoyale ? "battle royale" : null,
                  kind.usesInGameName ? "in-game name" : null,
                  kind.usesVenue ? "venue" : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "no game extras"}
              </span>
              {kind.slug !== GAMES_KIND ? (
                <Button
                  variant="danger"
                  className="px-3 py-1 text-xs"
                  onClick={() => setKindDelete(kind)}
                >
                  Delete
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        <form onSubmit={addKind} className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Label"
            value={kindForm.label}
            onChange={(e) =>
              setKindForm({ ...kindForm, label: e.target.value })
            }
            placeholder="Board games"
            required
          />
          <Input
            label="Slug"
            value={kindForm.slug}
            onChange={(e) =>
              setKindForm({
                ...kindForm,
                slug: e.target.value.toLowerCase(),
              })
            }
            placeholder="board-games"
          />
          <label className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              checked={kindForm.usesPlatforms}
              onChange={(e) =>
                setKindForm({ ...kindForm, usesPlatforms: e.target.checked })
              }
              className="h-4 w-4 accent-primary"
            />
            Platforms
          </label>
          <label className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              checked={kindForm.usesBattleRoyale}
              onChange={(e) =>
                setKindForm({
                  ...kindForm,
                  usesBattleRoyale: e.target.checked,
                })
              }
              className="h-4 w-4 accent-primary"
            />
            Battle royale
          </label>
          <label className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              checked={kindForm.usesInGameName}
              onChange={(e) =>
                setKindForm({ ...kindForm, usesInGameName: e.target.checked })
              }
              className="h-4 w-4 accent-primary"
            />
            In-game username
          </label>
          <label className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              checked={kindForm.usesVenue}
              onChange={(e) =>
                setKindForm({ ...kindForm, usesVenue: e.target.checked })
              }
              className="h-4 w-4 accent-primary"
            />
            Physical venue
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" loading={kindSaving}>
              Add kind
            </Button>
          </div>
        </form>
      </section>

      {gamesList.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-3">
          <div className="max-w-md flex-1">
            <Input
              placeholder="Search by name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search catalog"
            />
          </div>
          <div className="w-48">
            <Select
              label="Kind"
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              options={[
                { label: "All", value: "ALL" },
                ...kinds.map((k) => ({ label: k.label, value: k.slug })),
              ]}
            />
          </div>
        </div>
      ) : null}

      {loading && gamesList.length === 0 ? (
        <Loader label="Loading catalog" />
      ) : gamesList.length === 0 ? (
        <div className="rounded-2xl border border-surface-2 bg-surface p-10 text-center">
          <p className="text-body">
            No catalog items yet. Add Football or a game so hosts can pick it.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-surface-2 bg-surface p-10 text-center">
          <p className="text-body">No items match that filter.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((game) => (
            <div
              key={game.game_id}
              className="overflow-hidden rounded-2xl border border-surface-2 bg-surface"
            >
              <div className="relative h-36 w-full bg-surface-2">
                {game.image ? (
                  <CatalogImage
                    src={resolveIcon(game.image, FALLBACKS.tournament)}
                    alt={game.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-body">
                    No image
                  </div>
                )}
                <span
                  className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    game.active
                      ? "bg-win-deep text-white"
                      : "bg-surface-3 text-body"
                  }`}
                >
                  {game.active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="flex items-start gap-2 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    {kindLabel(game.kind || GAMES_KIND)}
                  </p>
                  <h3 className="truncate text-white">{game.name}</h3>
                  {game.formats.length > 0 ? (
                    <p className="mt-1 text-xs text-body">
                      {game.formats.map((f) => f.label).join(" · ")}
                    </p>
                  ) : game.platforms.length > 0 ? (
                    <p className="mt-1 text-xs text-body">
                      {game.platforms.join(" · ")}
                    </p>
                  ) : null}
                </div>
                <RowMenu
                  label={`Actions for ${game.name}`}
                  actions={[
                    { label: "Edit", onSelect: () => openEdit(game) },
                    {
                      label: game.active ? "Deactivate" : "Activate",
                      hint: game.active
                        ? "Hides it when creating tournaments"
                        : undefined,
                      onSelect: () => void toggleActive(game),
                    },
                    {
                      label: "Delete",
                      danger: true,
                      onSelect: () => setDeleteTarget(game),
                    },
                  ]}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit catalog item" : "Add catalog item"}
        width="max-w-xl"
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {!editing ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => applyPreset(FOOTBALL_PRESET)}
              >
                Football preset
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => applyPreset(BASKETBALL_PRESET)}
              >
                Basketball preset
              </Button>
            </div>
          ) : null}
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Select
            label="Kind"
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value })}
            options={kinds.map((k) => ({ label: k.label, value: k.slug }))}
          />
          <IconPicker
            label="Image"
            icons={covers}
            value={form.image}
            onChange={(url) => setForm({ ...form, image: url })}
            loading={coversLoading}
          />
          {flags.usesPlatforms ? (
            <MultiSelect
              label="Platforms"
              options={platformList.map((p) => ({
                label: p.name,
                value: p.name,
              }))}
              value={form.platforms}
              onChange={(platforms) => setForm({ ...form, platforms })}
              hint={
                platformList.length === 0
                  ? "Add platforms under Admin → Platforms first."
                  : "Select every platform this game runs on."
              }
            />
          ) : null}
          <div>
            <p className="mb-2 text-sm font-medium text-white">Formats</p>
            <p className="mb-3 text-xs text-body">
              For sports: 5-a-side, 3v3, and so on. Leave empty for video games
              (solo / duo / squad).
            </p>
            <div className="flex flex-col gap-2">
              {form.formats.map((row, i) => (
                <div key={row.id || i} className="flex gap-2">
                  <Input
                    placeholder="5-a-side"
                    value={row.label}
                    onChange={(e) => {
                      const next = [...form.formats];
                      const label = e.target.value;
                      next[i] = {
                        ...row,
                        label,
                        id: label.trim().toLowerCase().replace(/\s+/g, "-") || row.id,
                      };
                      setForm({ ...form, formats: next });
                    }}
                  />
                  <Input
                    type="number"
                    min={1}
                    max={32}
                    className="w-24"
                    value={row.roster}
                    onChange={(e) => {
                      const next = [...form.formats];
                      next[i] = {
                        ...row,
                        roster: Math.max(1, Number(e.target.value) || 1),
                      };
                      setForm({ ...form, formats: next });
                    }}
                  />
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() =>
                      setForm({
                        ...form,
                        formats: form.formats.filter((_, idx) => idx !== i),
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="dark"
                onClick={() =>
                  setForm({
                    ...form,
                    formats: [
                      ...form.formats,
                      { id: `format-${form.formats.length + 1}`, label: "", roster: 5 },
                    ],
                  })
                }
              >
                Add format
              </Button>
            </div>
          </div>
          <Select
            label="Score label"
            value={form.scoreLabel}
            onChange={(e) =>
              setForm({
                ...form,
                scoreLabel: e.target.value === "Points" ? "Points" : "Goals",
              })
            }
            options={[
              { label: "Goals", value: "Goals" },
              { label: "Points", value: "Points" },
            ]}
          />
          <label className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              checked={form.allowDraw}
              onChange={(e) =>
                setForm({ ...form, allowDraw: e.target.checked })
              }
              className="h-4 w-4 accent-primary"
            />
            Allow draws (league / group points)
          </label>
          <label className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
            Active (selectable when creating tournaments)
          </label>
          <div className="sticky bottom-0 z-1 flex justify-end gap-3 bg-surface pt-3">
            <Button
              type="button"
              variant="dark"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save changes" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>
      <Confirm
        open={deleteTarget !== null}
        title="Delete this item?"
        message={`Delete "${deleteTarget?.name ?? ""}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={() => void remove()}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
      <Confirm
        open={kindDelete !== null}
        title="Delete this kind?"
        message={`Delete "${kindDelete?.label ?? ""}"? Catalog items keep their kind slug.`}
        confirmLabel="Delete"
        onConfirm={() => void removeKind()}
        onCancel={() => setKindDelete(null)}
      />
    </div>
  );
}
