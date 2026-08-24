"use client";

import { useState } from "react";
import Link from "next/link";
import type { User } from "@/lib/schemas/user";
import type { Tournament } from "@/lib/schemas/tournament";
import type { RegisterTournament } from "@/lib/schemas/register";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import {
  changePasswordAction,
  updateProfileAction,
} from "@/server/actions/userActions";
import { playerIconFor } from "@/lib/icons";

export function ProfileView({
  profile,
  created,
  registered,
}: {
  profile: User;
  created: Tournament[];
  registered: RegisterTournament[];
}) {
  const { user, orgs, setUser } = useAuth();
  const toast = useToast();
  const isOwn = user?.user_id === profile.user_id;

  const [editOpen, setEditOpen] = useState(false);
  const [passOpen, setPassOpen] = useState(false);

  return (
    <div>
      <section className="gradient-brand-page">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-5 py-16 text-center">
          <div className="relative h-24 w-24 overflow-hidden rounded-full bg-primary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={playerIconFor(profile.user_id)}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <h1 className="font-display text-4xl text-white">
              {profile.first_name} {profile.last_name}
            </h1>
            <p className="text-white/80">@{profile.user_name}</p>
          </div>
          {isOwn && (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                Edit profile
              </Button>
              <Button variant="dark" onClick={() => setPassOpen(true)}>
                Change password
              </Button>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-5 py-10 sm:grid-cols-3">
        <Stat label="Tournaments created" value={created.length} />
        <Stat label="Tournaments joined" value={registered.length} />
        <Stat label="Country" value={profile.country || "—"} />
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-16">
        <h2 className="mb-4 text-xl font-semibold text-white">
          Recently created
        </h2>
        {created.length === 0 ? (
          <p className="text-body">No tournaments created yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {created.map((t) => (
              <Link
                key={`${t._id}:${t.TournamentId}`}
                href={`/tournament/${t.TournamentId}`}
                className="rounded-xl border border-surface-2 bg-surface p-4 transition-colors hover:border-primary/40"
              >
                <h3 className="font-semibold text-white">{t.Name}</h3>
                <p className="text-sm text-body">{t.GameName}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {isOwn && (
        <section className="mx-auto max-w-5xl px-5 pb-16">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">
              Your organizations
            </h2>
            <Link href="/org" className="text-sm text-primary hover:underline">
              Manage
            </Link>
          </div>
          {orgs.length === 0 ? (
            <p className="text-body">
              You don&apos;t belong to any organizations.{" "}
              <Link href="/org/new" className="text-primary hover:underline">
                Create one
              </Link>
              .
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {orgs.map((org) => (
                <Link
                  key={org.org_id}
                  href={`/org/${org.org_id}`}
                  className="flex items-center justify-between rounded-xl border border-surface-2 bg-surface p-4 transition-colors hover:border-primary/40"
                >
                  <span className="font-semibold text-white">{org.name}</span>
                  <span className="text-xs text-primary">{org.role}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {isOwn && (
        <>
          <EditProfileModal
            open={editOpen}
            profile={profile}
            onClose={() => setEditOpen(false)}
            onSaved={(u) => {
              setUser(u);
              setEditOpen(false);
              toast.success("Profile updated");
            }}
          />
          <ChangePasswordModal
            open={passOpen}
            onClose={() => setPassOpen(false)}
            onSaved={() => {
              setPassOpen(false);
              toast.success("Password changed");
            }}
          />
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-surface-2 bg-surface p-5 text-center">
      <p className="text-2xl font-bold text-primary">{value}</p>
      <p className="mt-1 text-sm text-body">{label}</p>
    </div>
  );
}

function EditProfileModal({
  open,
  profile,
  onClose,
  onSaved,
}: {
  open: boolean;
  profile: User;
  onClose: () => void;
  onSaved: (user: User) => void;
}) {
  const toast = useToast();
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
    const result = await updateProfileAction(form);
    setLoading(false);
    if (result.ok) onSaved(result.data);
    else toast.error(result.error);
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit profile">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
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
          label="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-4">
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
        <Button type="submit" loading={loading} fullWidth>
          Save changes
        </Button>
      </form>
    </Modal>
  );
}

function ChangePasswordModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <Modal open={open} onClose={onClose} title="Change password">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          type="password"
          label="Current password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          type="password"
          label="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <Button type="submit" loading={loading} fullWidth>
          Update password
        </Button>
      </form>
    </Modal>
  );
}
