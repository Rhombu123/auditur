import Image from "next/image";

type Props = {
  size?: number;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ size = 32, className, priority = false }: Props) {
  return (
    <Image
      src="/auditur-logo.png"
      alt="Auditur"
      width={size}
      height={size}
      priority={priority}
      className={className}
    />
  );
}
