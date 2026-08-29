"use client";

import { useState } from "react";
import Link from "next/link";
import type { User } from "@/lib/schemas/user";
import type { Tournament } from "@/lib/schemas/tournament";
import type { RegisterTournament } from "@/lib/schemas/register";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { isStrongPassword } from "@/lib/password";
import {
  changePasswordAction,
  updateProfileAction,
} from "@/server/actions/userActions";
import { requestContactChangeAction } from "@/server/actions/contactActions";
import { CatalogAvatar } from "@/components/ui/CatalogAvatar";
import { VerifiedName } from "@/components/ui/VerifiedName";
import { IconPicker } from "@/components/ui/IconPicker";
import { useIcons } from "@/hooks/useIcons";
import { FALLBACKS, playerIconFor } from "@/lib/icons";
import {
  TournamentCard,
  EmptyTournaments,
} from "@/components/tournament/TournamentCard";
import { SavedTeams } from "@/components/profile/SavedTeams";
import { PayoutAccounts } from "@/components/profile/PayoutAccounts";
import { PageTour } from "@/components/help/PageTour";
import { PROFILE_TOUR } from "@/components/help/tours";
import { helpTarget } from "@/lib/help";

/**
 * One page for a player, whether it is yours or someone else's. Visitors see
 * the overview; on your own profile the same page also carries your teams,
 * payouts, organizations and account settings. There is no separate dashboard.
 */
type ProfileTab =
  | "overview"
  | "teams"
  | "payouts"
  | "organizations"
  | "settings";

const OWN_TABS: { id: ProfileTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "teams", label: "Teams" },
  { id: "payouts", label: "Payouts" },
  { id: "organizations", label: "Organizations" },
  { id: "settings", label: "Settings" },
];

export function ProfileView({
  profile,
  created,
  registered,
  initialTab = "overview",
}: {
  profile: User;
  created: Tournament[];
  registered: RegisterTournament[];
  initialTab?: ProfileTab;
}) {
  const { user, orgs, setUser } = useAuth();
  const toast = useToast();
  const isOwn = user?.user_id === profile.user_id;
  const { icons: playerIcons, loading: playerIconsLoading } = useIcons("player");
  const [display, setDisplay] = useState(profile);
  const [savingIcon, setSavingIcon] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [tab, setTab] = useState<ProfileTab>(initialTab);

  const defaultIcon =
    display.icon ||
    playerIconFor(display.user_id, playerIcons) ||
    FALLBACKS.player;

  const saveDefaultIcon = async (url: string) => {
    if (url === display.icon) {
      setIconOpen(false);
      return;
    }
    setSavingIcon(true);
    const result = await updateProfileAction({ icon: url });
    setSavingIcon(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setUser(result.data);
    setDisplay(result.data);
    setIconOpen(false);
    toast.success("Default icon saved");
  };

  const fullName =
    `${display.first_name} ${display.last_name}`.trim() || display.user_name;
  const place = [display.location, display.country].filter(Boolean).join(", ");

  return (
    <div>
      {isOwn ? <PageTour tour={PROFILE_TOUR} /> : null}

      <section className="border-b border-primary/20 bg-primary-panel">
        <div className="mx-auto flex max-w-page flex-col gap-6 px-page py-10 sm:flex-row sm:items-center sm:justify-between lg:py-12">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative shrink-0">
              <div className="h-20 w-20 overflow-hidden rounded-full bg-surface-2 ring-2 ring-primary/40">
                <CatalogAvatar
                  userId={display.user_id}
                  icon={display.icon}
                  className="h-full w-full object-cover"
                />
              </div>
              {isOwn ? (
                <button
                  type="button"
                  onClick={() => setIconOpen(true)}
                  className="absolute -bottom-1 -right-1 grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-primary/40 bg-surface text-primary shadow-lg transition-colors hover:bg-primary hover:text-on-primary"
                  aria-label="Change icon"
                >
                  <PencilIcon />
                </button>
              ) : null}
            </div>
            <div className="min-w-0">
              <VerifiedName
                as="h1"
                name={fullName}
                verified={display.verified}
                className="font-display text-3xl leading-none text-white md:text-4xl"
              />
              <p className="mt-1 text-body">@{display.user_name}</p>
              {place ? (
                <p className="mt-0.5 text-sm text-body">{place}</p>
              ) : null}
            </div>
          </div>
          {isOwn ? (
            <div className="flex flex-wrap gap-3">
              <Link href="/tournament/new" {...helpTarget("dash-create")}>
                <Button>Create tournament</Button>
              </Link>
              <Button variant="outline" onClick={() => setTab("settings")}>
                Settings
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {isOwn ? (
        <div className="border-b border-surface-2 bg-nav">
          <div className="mx-auto flex max-w-page gap-1 overflow-x-auto px-page">
            {OWN_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`cursor-pointer whitespace-nowrap border-b-2 px-4 py-4 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-body hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "overview" || !isOwn ? (
        <>
          <section className="mx-auto grid max-w-page gap-4 px-page py-10 sm:grid-cols-3">
            <Stat label="Tournaments created" value={created.length} />
            <Stat label="Tournaments joined" value={registered.length} />
            <Stat label="Country" value={display.country || "-"} />
          </section>

          <section
            className="mx-auto max-w-page px-page pb-12"
            {...helpTarget("dash-hosted")}
          >
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-2xl text-white">
                {isOwn ? "Tournaments you created" : "Tournaments created"}
              </h2>
              <Link
                href="/tournament/all/ALL/ALL"
                className="text-sm text-primary hover:underline"
              >
                Browse all
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {created.length === 0 ? (
                <EmptyTournaments
                  message={
                    isOwn
                      ? "You have not created a tournament yet."
                      : "No tournaments created yet."
                  }
                />
              ) : (
                created.map((t) => (
                  <TournamentCard
                    key={`${t._id}:${t.TournamentId}`}
                    tournament={t}
                  />
                ))
              )}
            </div>
          </section>

          <section
            className="mx-auto max-w-page px-page pb-16"
            {...helpTarget("dash-joined")}
          >
            <h2 className="mb-6 font-display text-2xl text-white">
              {isOwn ? "Tournaments you joined" : "Tournaments joined"}
            </h2>
            {registered.length === 0 ? (
              <p className="text-body">
                {isOwn
                  ? "You have not joined a tournament yet."
                  : "No tournaments joined yet."}
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {registered.map((reg) => (
                  <Link
                    key={reg.RegisterTournamentId || reg._id}
                    href={`/tournament/${reg.TournamentId}`}
                    className="arena-panel arena-hud-corners p-4 transition-colors hover:border-primary"
                  >
                    <h3 className="font-semibold text-white">
                      {reg.TournamentName || "Tournament"}
                    </h3>
                    <p className="text-sm text-body">Team: {reg.TeamName}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      {isOwn && tab === "teams" ? (
        <section className="mx-auto max-w-3xl px-page py-10">
          <SavedTeams />
        </section>
      ) : null}

      {isOwn && tab === "payouts" ? (
        <section className="mx-auto max-w-3xl px-page py-10">
          <PayoutAccounts />
        </section>
      ) : null}

      {isOwn && tab === "organizations" ? (
        <section className="mx-auto max-w-page px-page py-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-white">
                Your organizations
              </h2>
              <p className="mt-1 text-sm text-body">
                Host tournaments under a shared name.
              </p>
            </div>
            <Link href="/org/new">
              <Button variant="outline">Create organization</Button>
            </Link>
          </div>
          {orgs.length === 0 ? (
            <div className="rounded-2xl border border-surface-2 bg-surface p-10 text-center">
              <p className="text-body">
                You don&apos;t belong to any organizations yet.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {orgs.map((org) => (
                <Link
                  key={org.org_id}
                  href={`/org/${org.org_id}`}
                  className="flex items-center justify-between rounded-xl border border-surface-2 bg-surface p-4 transition-colors hover:border-primary/40"
                >
                  <VerifiedName
                    name={org.name}
                    verified={org.verified}
                    className="font-semibold text-white"
                  />
                  <span className="text-xs text-primary">{org.role}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {isOwn && tab === "settings" ? (
        <section className="mx-auto flex max-w-3xl flex-col gap-6 px-page py-10">
          <EditProfileCard
            profile={display}
            onSaved={(u) => {
              setUser(u);
              setDisplay(u);
              toast.success("Profile updated");
            }}
          />
          <ChangePasswordCard
            onSaved={() => toast.success("Password changed")}
          />
          {display.verified ? (
            <RequestContactChangeCard profile={display} />
          ) : null}
          <div className="rounded-xl border border-surface-2 bg-surface p-5">
            <h3 className="font-semibold text-white">Default player icon</h3>
            <p className="mt-1 text-sm text-body">
              Shows on your profile and in the nav. You can still pick a
              different icon when you register for a tournament.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setIconOpen(true)}
            >
              Choose icon
            </Button>
          </div>
        </section>
      ) : null}

      {isOwn ? (
        <Modal
          open={iconOpen}
          onClose={() => setIconOpen(false)}
          title="Choose your icon"
          width="max-w-xl"
        >
          <p className="mb-4 text-sm text-body">
            This shows on your profile and in the nav. You can still pick a
            different player icon when you register for a tournament.
          </p>
          <IconPicker
            label="Player icons"
            icons={playerIcons}
            value={defaultIcon}
            onChange={(url) => void saveDefaultIcon(url)}
            loading={playerIconsLoading || savingIcon}
          />
        </Modal>
      ) : null}
    </div>
  );
}

function PencilIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="arena-panel arena-hud-corners p-5">
      <p className="font-display text-3xl text-primary">{value}</p>
      <p className="mt-1 text-sm text-body">{label}</p>
    </div>
  );
}

function EditProfileCard({
  profile,
  onSaved,
}: {
  profile: User;
  onSaved: (user: User) => void;
}) {
  const toast = useToast();
  // A verified account is one whose contact details we confirmed, so those two
  // fields are read-only here and change only through a checked request.
  const locked = profile.verified;
  const [form, setForm] = useState({
    first_name: profile.first_name,
    last_name: profile.last_name,
    user_name: profile.user_name,
    phone: profile.phone,
    country: profile.country,
    location: profile.location,
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Never send locked fields; the server rejects them anyway.
    const { phone, ...rest } = form;
    const result = await updateProfileAction(locked ? rest : { ...rest, phone });
    setLoading(false);
    if (result.ok) onSaved(result.data);
    else toast.error(result.error);
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-xl border border-surface-2 bg-surface p-5"
    >
      <div>
        <h3 className="font-semibold text-white">Profile details</h3>
        <p className="mt-1 text-sm text-body">
          Your name and username are how other players find you.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="First name"
          value={form.first_name}
          onChange={(e) => setForm({ ...form, first_name: e.target.value })}
        />
        <Input
          label="Last name"
          value={form.last_name}
          onChange={(e) => setForm({ ...form, last_name: e.target.value })}
        />
      </div>
      <Input
        label="Username"
        value={form.user_name}
        onChange={(e) => setForm({ ...form, user_name: e.target.value })}
      />
      <Input
        label="Email"
        value={profile.email}
        disabled
        readOnly
      />
      <Input
        label="Phone"
        value={form.phone}
        disabled={locked}
        readOnly={locked}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />
      {locked ? (
        <div className="rounded-lg border border-primary/35 bg-primary/10 p-4">
          <p className="text-sm text-white">
            Your account is verified, so your email and phone are locked.
          </p>
          <p className="mt-1 text-sm text-body">
            Verified means we confirmed these details are correct and that we
            can reach you. Letting them be edited afterwards would undo that, so
            a change has to be checked first.
          </p>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Country"
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value })}
        />
        <Input
          label="Location"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

function ChangePasswordCard({ onSaved }: { onSaved: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStrongPassword(newPassword)) {
      toast.error("New password does not meet the requirements");
      return;
    }
    setLoading(true);
    const result = await changePasswordAction({ password, newPassword });
    setLoading(false);
    if (result.ok) {
      setPassword("");
      setNewPassword("");
      onSaved();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 rounded-xl border border-surface-2 bg-surface p-5"
    >
      <div>
        <h3 className="font-semibold text-white">Password</h3>
        <p className="mt-1 text-sm text-body">
          Use something you don&apos;t reuse anywhere else.
        </p>
      </div>
      <PasswordInput
        label="Current password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
      />
      <div className="flex flex-col gap-2">
        <PasswordInput
          label="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <PasswordStrength value={newPassword} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          Update password
        </Button>
      </div>
    </form>
  );
}

/**
 * Verified users cannot edit their own email or phone, so this files a request
 * for the team to verify and apply. Verification is only meaningful if the
 * details cannot be swapped out afterwards without a check.
 */
function RequestContactChangeCard({ profile }: { profile: User }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    const result = await requestContactChangeAction({
      Email: email.trim(),
      Phone: phone.trim(),
      Message: message.trim(),
    });
    setSending(false);
    if (result.ok) {
      toast.success(result.message ?? "Request sent");
      setEmail("");
      setPhone("");
      setMessage("");
      setSent(true);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-xl border border-surface-2 bg-surface p-5"
    >
      <div>
        <h3 className="font-semibold text-white">
          Request a contact change
        </h3>
        <p className="mt-1 text-sm text-body">
          Tell us what your email or phone should be. We verify the new details
          before anything changes, so this is not instant.
        </p>
      </div>
      <Input
        label="New email (optional)"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={profile.email}
      />
      <Input
        label="New phone (optional)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder={profile.phone || "Include the country code"}
      />
      <Input
        label="Anything we should know? (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Why the change is needed"
      />
      <div className="flex items-center justify-end gap-3">
        {sent ? (
          <span className="text-sm text-body">
            Request received. We will be in touch.
          </span>
        ) : null}
        <Button
          type="submit"
          loading={sending}
          disabled={!email.trim() && !phone.trim()}
        >
          Send request
        </Button>
      </div>
    </form>
  );
}
