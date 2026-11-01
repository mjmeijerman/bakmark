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
	why: { nl: "/waarom", en: "/why" },
	who: { nl: "/wie", en: "/who" },
	how: { nl: "/hoe-het-werkt", en: "/how-it-works" },
	contact: { nl: "/contact", en: "/contact" },
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
	"nav.why": "Waarom",
	"nav.who": "Wie",
	"nav.how": "Hoe het werkt",
	"nav.contact": "Contact",
	"footer.tagline": "Bakken zonder knippen. Alles in één take, alles vrij te lezen.",
	"footer.affiliate":
		"Soms staat er een affiliate-link. Die is altijd gemarkeerd en kost jou niets extra.",
	"footer.privacy": "Contact en privacy",
	"home.title": "Welkom bij Bakmark",
	"home.description":
		"Duidelijke recepten in een overzichtelijke catalogus, met een video bij elk recept. Gratis te lezen, met een fooi als je wilt.",
	"home.lead":
		"Duidelijke recepten in een overzichtelijke catalogus, met een video bij elk recept.",
	"home.newest": "Nieuwste recepten",
	"home.browse": "Bekijk de recepten",
	"newsletter.heading": "Eén bericht per nieuwe video",
	"newsletter.label": "Je e-mailadres",
	"newsletter.button": "Inschrijven",
	"newsletter.note":
		"De inschrijving opent bij de eerste video. Je adres wordt alleen gebruikt voor dat ene bericht; uitschrijven kan met één klik. Het blijft bij Bakmark.",
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
	"nav.why": "Why",
	"nav.who": "Who",
	"nav.how": "How it works",
	"nav.contact": "Contact",
	"footer.tagline": "Baking without cuts. Everything in one take, everything free to read.",
	"footer.affiliate":
		"Sometimes there is an affiliate link. It is always marked and costs you nothing extra.",
	"footer.privacy": "Contact and privacy",
	"home.title": "Welcome to Bakmark",
	"home.description":
		"Clear recipes in an orderly catalogue, with a video for every recipe. Free to read, with a tip if you like.",
	"home.lead": "Clear recipes in an orderly catalogue, with a video for every recipe.",
	"home.newest": "Latest recipes",
	"home.browse": "Browse the recipes",
	"newsletter.heading": "One email per new video",
	"newsletter.label": "Your email address",
	"newsletter.button": "Subscribe",
	"newsletter.note":
		"Sign-ups open with the first video. Your address is used only for that one message; unsubscribing takes one click. It stays with Bakmark.",
};

const DICTS: Record<Lang, Dict> = { nl, en };

/** Falls back to Dutch, then to the key itself, so a missing string is visible. */
export const t = (lang: Lang, key: string): string => DICTS[lang][key] ?? nl[key] ?? key;
