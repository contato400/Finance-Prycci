"use client";

import { useState } from "react";
import { getBankLogoUrl, getColorFromName } from "@/lib/bank-logos";

interface BankAvatarProps {
  bankName: string;
  size?: number;
  className?: string;
}

export function BankAvatar({ bankName, size = 32, className = "" }: BankAvatarProps) {
  const logoUrl = getBankLogoUrl(bankName);
  const [imgError, setImgError] = useState(false);

  const initials = bankName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (logoUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={bankName}
        width={size}
        height={size}
        className={`rounded-full bg-white object-contain ${className}`}
        style={{ width: size, height: size }}
        onError={() => setImgError(true)}
      />
    );
  }

  const color = getColorFromName(bankName);

  return (
    <div
      className={`flex items-center justify-center rounded-full font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size * 0.35,
      }}
    >
      {initials}
    </div>
  );
}
