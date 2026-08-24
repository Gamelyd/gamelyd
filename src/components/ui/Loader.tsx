import Image from "next/image";

export function Loader({ fullscreen = false }: { fullscreen?: boolean }) {
  const ring = (
    <span className="relative flex h-20 w-20 items-center justify-center">
      <span className="absolute inset-0 animate-[gamelyd-spin_0.8s_linear_infinite] rounded-full border-4 border-primary/25 border-t-primary" />
      <Image
        src="/icon.png"
        alt="Gamelyd"
        width={44}
        height={44}
        className="h-11 w-11 object-contain"
      />
    </span>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-bg/80 backdrop-blur-sm">
        {ring}
      </div>
    );
  }
  return <div className="flex items-center justify-center py-10">{ring}</div>;
}
