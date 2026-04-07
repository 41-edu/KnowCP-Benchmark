import { useEffect, useState } from "react";
import { useLocale } from "../hooks/useLocale";
import { translateRuntimeText } from "../utils/runtimeTranslate";

export function TranslatedText({
  text,
  preserveChoiceOptions,
}: {
  text: string;
  preserveChoiceOptions?: boolean;
}) {
  const { locale } = useLocale();
  const [displayText, setDisplayText] = useState(text);

  useEffect(() => {
    let cancelled = false;
    setDisplayText(text);

    async function run() {
      const translated = await translateRuntimeText(text, locale, { preserveChoiceOptions });
      if (!cancelled) {
        setDisplayText(translated);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [locale, preserveChoiceOptions, text]);

  return <>{displayText}</>;
}
