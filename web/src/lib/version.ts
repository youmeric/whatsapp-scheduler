// Version de l'app, injectée au build par GitHub Actions via des build-args
// Docker → ENV NEXT_PUBLIC_* → inlinée par Next.js dans le bundle.
// En dev local (npm run dev), ces variables ne sont pas définies → "dev".

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev"
export const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || ""

/** SHA court (7 car.) si c'est un hash git, sinon la valeur telle quelle. */
export function displayVersion(): string {
  const v = APP_VERSION
  if (!v || v === "dev") return "dev"
  return /^[0-9a-f]{7,40}$/i.test(v) ? v.slice(0, 7) : v
}
