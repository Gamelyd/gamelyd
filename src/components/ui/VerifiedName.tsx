"use client";

/** Gold check used next to verified player and organization names. */
export function VerifiedBadge({
  className = "",
  title = "Verified",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 text-yellow ${className}`.trim()}
      aria-label={title}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-[1em] w-[1em]" aria-hidden>
        <path
          fillRule="evenodd"
          d="M10 1.8a8.2 8.2 0 1 0 0 16.4 8.2 8.2 0 0 0 0-16.4Zm3.3 6.05-4.05 4.1-2.5-2.5-.9.9 3.4 3.4 4.95-5-.9-.9Z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

export function VerifiedName({
  name,
  verified,
  className = "",
  as: Tag = "span",
}: {
  name: string;
  verified?: boolean;
  className?: string;
  as?: "span" | "h1" | "h2" | "h3" | "p";
}) {
  return (
    <Tag className={`inline-flex max-w-full items-center gap-1 ${className}`.trim()}>
      <span className="min-w-0 truncate">{name}</span>
      {verified ? <VerifiedBadge /> : null}
    </Tag>
  );
}

export function isSoloVerified(
  players?: { Verified?: boolean }[],
): boolean {
  return Boolean(players?.length === 1 && players[0]?.Verified);
}

export function PlayerNameList({
  players,
  className = "",
  empty = "No players listed",
}: {
  players: { UserName?: string; Verified?: boolean }[];
  className?: string;
  empty?: string;
}) {
  const named = players.filter((player) => player.UserName);
  if (named.length === 0) {
    return <span className={className}>{empty}</span>;
  }
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1 ${className}`.trim()}>
      {named.map((player, i) => (
        <span key={`${player.UserName}-${i}`} className="inline-flex items-center">
          {i > 0 ? <span className="text-inherit opacity-60"> · </span> : null}
          <VerifiedName name={player.UserName || ""} verified={player.Verified} />
        </span>
      ))}
    </span>
  );
}
