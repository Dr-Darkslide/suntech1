import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { FloatingWhatsApp } from "@/components/ui/FloatingWhatsApp";
import { CursorGlow } from "@/components/ui/CursorGlow";
import { CotizadorModalProvider } from "@/components/cotizador/CotizadorModalContext";
import { CotizadorModal } from "@/components/cotizador/CotizadorModal";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as "es" | "en")) notFound();

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <CotizadorModalProvider>
        <Navbar />
        <main>{children}</main>
        <Footer />
        <FloatingWhatsApp />
        <ScrollToTop />
        <CursorGlow />
        <CotizadorModal />
      </CotizadorModalProvider>
    </NextIntlClientProvider>
  );
}
