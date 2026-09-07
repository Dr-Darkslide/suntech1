"use client";

import { useRef } from "react";
import { Lottie, type LottieHandle } from "lottie-react";
import { useTranslations } from "next-intl";
import { WHATSAPP_URL } from "@/lib/data/company";
import animationData from "./whatsapp-lottie.json";

export function FloatingWhatsApp() {
  const t = useTranslations("common");
  const lottie = useRef<LottieHandle>(null);

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("whatsapp_float")}
      title={t("whatsapp_float")}
      onPointerEnter={() => lottie.current?.play()}
      onPointerLeave={() => lottie.current?.stop()}
      onFocus={() => lottie.current?.play()}
      onBlur={() => lottie.current?.stop()}
      className="fixed bottom-6 right-6 z-40 block h-[4.5rem] w-[4.5rem] drop-shadow-lg transition-transform duration-200 hover:scale-110 active:scale-95 sm:h-14 sm:w-14"
    >
      {/* Vector + transparent: no white box. Sits on frame 0 until hover/focus,
          then loops; stop() drops it back to the first frame. */}
      <Lottie
        lottieRef={lottie}
        src={animationData}
        loop
        autoplay={false}
        className="h-full w-full"
        aria-hidden
      />
    </a>
  );
}
