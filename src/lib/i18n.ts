/**
 * Two languages, one source of truth per string.
 *
 * Dutch is the default and lives at the root; English lives under /en.
 * Route keys, not literal paths, so a page never hard-codes a prefix.
 */

export const LANGS = ["nl", "en"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "nl";

export const isLang = (value: string | undefined): value is Lang =>
	value === "nl" || value === "en";

/** English URL segments where the Dutch word would read as noise. */
const ROUTES = {
	home: { nl: "/", en: "/" },
	recipes: { nl: "/recepten", en: "/recipes" },
	recipe: { nl: "/recepten/", en: "/recipes/" },
	who: { nl: "/wie", en: "/who" },
	how: { nl: "/hoe-het-werkt", en: "/how-it-works" },
	contact: { nl: "/contact", en: "/contact" },
	privacy: { nl: "/privacy", en: "/privacy" },
} as const;

export type RouteKey = keyof typeof ROUTES;

/** `path("en", "recipes")` → `/en/recipes`; `param` appends a recipe slug. */
export const path = (lang: Lang, route: RouteKey, param?: string): string => {
	const segment = ROUTES[route][lang] + (param ?? "");
	return lang === DEFAULT_LANG ? segment : `/en${segment}`;
};

/** Same page in the other language, for the language toggle. */
export const alternatePath = (pathname: string, lang: Lang): string => {
	const other: Lang = lang === "nl" ? "en" : "nl";
	const bare = lang === DEFAULT_LANG ? pathname : pathname.replace(/^\/en(?=\/|$)/, "") || "/";

	for (const key of Object.keys(ROUTES) as RouteKey[]) {
		const from = ROUTES[key][lang];
		if (key === "recipe" && bare.startsWith(from) && bare !== from) {
			return path(other, "recipe", bare.slice(from.length));
		}
		if (key === "recipes" && bare === from) return path(other, "recipes");
		if (key !== "recipe" && key !== "recipes" && bare === from) return path(other, key);
	}
	return path(other, "home");
};

type Dict = Record<string, string>;

const nl: Dict = {
	"lang.name": "Nederlands",
	"lang.switch": "Lees in het Engels",
	"lang.toggle": "EN",
	"lang.aria": "Taal",
	"skip": "Naar de inhoud",
	"nav.aria": "Hoofdnavigatie",
	"nav.home": "Home",
	"nav.recipes": "Alle recepten",
	"nav.who": "Over mij",
	"nav.how": "Over de website",
	"nav.contact": "Contact",
	"footer.privacy": "Privacy",
	"home.title": "Welkom bij Bakmark",
	"home.description":
		"Duidelijke recepten in een overzichtelijke catalogus, met een video bij elk recept. Gratis te lezen, met een fooi als je wilt.",
	"home.lead":
		"Duidelijke recepten in een overzichtelijke catalogus, met een video bij elk recept.",
	"home.newest": "Nieuwste recepten",
	"home.browse": "Bekijk de recepten",
	"newsletter.heading": "Schrijf je in voor de nieuwsbrief",
	"newsletter.label": "Je e-mailadres",
	"newsletter.button": "Inschrijven",
	"newsletter.note":
		"Schrijf je in voor de nieuwsbrief en je krijgt een mailtje als er nieuwe recepten geplaatst zijn.",
};

const en: Dict = {
	"lang.name": "English",
	"lang.switch": "Read in Dutch",
	"lang.toggle": "NL",
	"lang.aria": "Language",
	"skip": "Skip to content",
	"nav.aria": "Main navigation",
	"nav.home": "Home",
	"nav.recipes": "All recipes",
	"nav.who": "About me",
	"nav.how": "About the website",
	"nav.contact": "Contact",
	"footer.privacy": "Privacy",
	"home.title": "Welcome to Bakmark",
	"home.description":
		"Clear recipes in an orderly catalogue, with a video for every recipe. Free to read, with a tip if you like.",
	"home.lead": "Clear recipes in an orderly catalogue, with a video for every recipe.",
	"home.newest": "Latest recipes",
	"home.browse": "Browse the recipes",
	"newsletter.heading": "Subscribe to the newsletter",
	"newsletter.label": "Your email address",
	"newsletter.button": "Subscribe",
	"newsletter.note":
		"Subscribe to the newsletter and you will get an email when new recipes are published.",
};

const DICTS: Record<Lang, Dict> = { nl, en };

/** Falls back to Dutch, then to the key itself, so a missing string is visible. */
export const t = (lang: Lang, key: string): string => DICTS[lang][key] ?? nl[key] ?? key;
