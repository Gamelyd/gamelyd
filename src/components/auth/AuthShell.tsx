import Image from "next/image";
import type { ReactNode } from "react";

const LEFT_BG =
  'url("https://ik.imagekit.io/dmkczkqll/Gamelyd/Backgrounds/siren.svg?updatedAt=1701865629886"), url("https://ik.imagekit.io/dmkczkqll/Gamelyd/Backgrounds/siren1.svg?updatedAt=1701869410057"), black';
const PAD_BG =
  'url("https://ik.imagekit.io/dmkczkqll/Gamelyd/Backgrounds/pad.svg?updatedAt=1701866171804")';

export function AuthShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-row bg-black">
      <div
        className="hidden w-[60vw] flex-col items-center justify-center bg-cover bg-center bg-no-repeat md:flex"
        style={{ background: LEFT_BG, backgroundBlendMode: "hard-light" }}
      >
        <div
          className="h-[370px] w-[422px] max-w-[80%] bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: PAD_BG }}
        />
      </div>

      <div className="h-screen w-full overflow-auto md:w-[40vw]">
        <div className="flex flex-col items-center">
          <Image
            src="/images/logoWhite.png"
            alt="Gamelyd"
            width={220}
            height={90}
            className="mb-[70px] mt-[60px] h-[90px] w-[220px] object-contain"
          />
          <h1 className="mb-[50px] px-6 text-center font-display text-[36px] leading-tight text-white">
            {title}
          </h1>
        </div>
        <div className="mx-auto w-full max-w-md px-6 pb-16">{children}</div>
      </div>
    </div>
  );
}
