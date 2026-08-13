import { db } from "@/lib/db";
import { themeToCss, type ThemeTokens } from "@/lib/themes";

/**
 * Emits the CSS custom properties for every enabled skin in one <style> tag,
 * so switching theme or colour mode is a single attribute flip on <html>.
 */
export default async function ThemeStyles() {
  const themes = await db.theme.findMany({ where: { enabled: true } });
  const css = themes
    .map((theme) => {
      try {
        return themeToCss(theme.slug, JSON.parse(theme.tokens) as ThemeTokens);
      } catch {
        return "";
      }
    })
    .join("\n");

  return <style id="nova-themes" dangerouslySetInnerHTML={{ __html: css }} />;
}
