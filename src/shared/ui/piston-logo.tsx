import Image from "next/image";

const ICON_SIZE = 36;
const LOGO_ASPECT = 172 / 48;

interface PistonLogoProps {
  className?: string;
  height?: number;
}

export function PistonLogo({ className = "", height = 24 }: PistonLogoProps) {
  const logoWidth = Math.round(height * LOGO_ASPECT);

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Image
        src="/Piston_Icon.svg"
        alt=""
        width={ICON_SIZE}
        height={ICON_SIZE}
        style={{ width: height, height }}
        unoptimized
      />
      <Image
        src="/Logo.svg"
        alt="PISTON"
        width={logoWidth}
        height={height}
        unoptimized
      />
    </span>
  );
}
