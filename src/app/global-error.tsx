"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_TAGS, type Locale } from "@/lib/i18n/config";

const subscribe = () => () => {};

// Its own few words, not the app's text tables: this page is loaded with every
// page (it must be ready should the root layout fail), and importing the
// tables here would ship every language to every visitor as script.
const TEXT: Record<Locale, { title: string; body: string; reload: string; home: string }> = {
  en: { title: "Something went wrong", body: "Please reload the page. If this keeps happening, try again in a few minutes.", reload: "Reload page", home: "Back to home" },
  hi: { title: "कुछ गड़बड़ हो गई", body: "कृपया पेज दोबारा लोड करें। अगर फिर भी ऐसा हो, तो कुछ मिनट बाद कोशिश करें।", reload: "पेज दोबारा लोड करें", home: "होम पर वापस जाएँ" },
  bn: { title: "কিছু একটা গোলমাল হয়েছে", body: "পেজটি আবার লোড করুন। বারবার এমন হলে কয়েক মিনিট পরে আবার চেষ্টা করুন।", reload: "পেজ আবার লোড করুন", home: "হোমে ফিরে যান" },
  mr: { title: "काहीतरी चुकले", body: "कृपया पेज पुन्हा लोड करा. असे पुन्हा पुन्हा होत असेल, तर काही मिनिटांनी प्रयत्न करा.", reload: "पेज पुन्हा लोड करा", home: "होमवर परत जा" },
  te: { title: "ఏదో తప్పు జరిగింది", body: "దయచేసి పేజీని రీలోడ్ చేయండి. ఇలాగే జరుగుతూ ఉంటే, కొన్ని నిమిషాల తర్వాత మళ్లీ ప్రయత్నించండి.", reload: "పేజీ రీలోడ్ చేయండి", home: "హోమ్‌కు వెనక్కి" },
  ta: { title: "ஏதோ தவறு நடந்தது", body: "பக்கத்தை மீண்டும் ஏற்றுங்கள். இது தொடர்ந்தால், சில நிமிடங்கள் கழித்து மீண்டும் முயலுங்கள்.", reload: "பக்கத்தை மீண்டும் ஏற்று", home: "முகப்புக்குத் திரும்பு" },
  gu: { title: "કંઈક ગડબડ થઈ", body: "કૃપા કરીને પેજ ફરી લોડ કરો. જો આવું થતું રહે, તો થોડી મિનિટ પછી ફરી પ્રયાસ કરો.", reload: "પેજ ફરી લોડ કરો", home: "હોમ પર પાછા જાઓ" },
  kn: { title: "ಏನೋ ತಪ್ಪಾಗಿದೆ", body: "ದಯವಿಟ್ಟು ಪುಟವನ್ನು ಮತ್ತೆ ಲೋಡ್ ಮಾಡಿ. ಹೀಗೆಯೇ ಆಗುತ್ತಿದ್ದರೆ, ಕೆಲವು ನಿಮಿಷಗಳ ನಂತರ ಪ್ರಯತ್ನಿಸಿ.", reload: "ಪುಟ ಮತ್ತೆ ಲೋಡ್ ಮಾಡಿ", home: "ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ" },
  ml: { title: "എന്തോ പ്രശ്നമുണ്ടായി", body: "ദയവായി പേജ് റീലോഡ് ചെയ്യുക. ഇത് വീണ്ടും സംഭവിച്ചാൽ, കുറച്ച് മിനിറ്റ് കഴിഞ്ഞ് ശ്രമിക്കുക.", reload: "പേജ് റീലോഡ് ചെയ്യുക", home: "ഹോമിലേക്ക് മടങ്ങുക" },
  or: { title: "କିଛି ଭୁଲ ହୋଇଗଲା", body: "ଦୟାକରି ପେଜ୍ ପୁଣି ଲୋଡ୍ କରନ୍ତୁ। ଯଦି ଏପରି ବାରମ୍ବାର ହେଉଛି, କିଛି ମିନିଟ୍ ପରେ ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।", reload: "ପେଜ୍ ପୁଣି ଲୋଡ୍ କରନ୍ତୁ", home: "ହୋମ୍‌କୁ ଫେରନ୍ତୁ" },
  pa: { title: "ਕੁਝ ਗੜਬੜ ਹੋ ਗਈ", body: "ਕਿਰਪਾ ਕਰਕੇ ਪੇਜ ਦੁਬਾਰਾ ਲੋਡ ਕਰੋ। ਜੇ ਫਿਰ ਵੀ ਇੰਝ ਹੋਵੇ, ਤਾਂ ਕੁਝ ਮਿੰਟਾਂ ਬਾਅਦ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", reload: "ਪੇਜ ਦੁਬਾਰਾ ਲੋਡ ਕਰੋ", home: "ਹੋਮ 'ਤੇ ਵਾਪਸ ਜਾਓ" },
};

// This page replaces the root layout, so the language provider is gone: read
// the chosen language from its cookie instead (English on the server).
const cookieLocale = (): Locale => {
  const value = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`))
    ?.split("=")[1];
  return isLocale(value) ? value : DEFAULT_LOCALE;
};

// Plain styles: globals.css is not loaded when the root layout itself failed.
const page: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  padding: 24,
  textAlign: "center",
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const locale = useSyncExternalStore(subscribe, cookieLocale, () => DEFAULT_LOCALE);
  const text = TEXT[locale];

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang={LOCALE_TAGS[locale]}>
      <body>
        <main style={page}>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>{text.title}</h1>
          <p style={{ fontSize: 14, maxWidth: 420, margin: 0 }}>{text.body}</p>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <button type="button" onClick={() => window.location.reload()} style={{ fontSize: 14, padding: "8px 16px", cursor: "pointer" }}>
              {text.reload}
            </button>
            <Link href="/" style={{ fontSize: 14, padding: "8px 0" }}>
              {text.home}
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
