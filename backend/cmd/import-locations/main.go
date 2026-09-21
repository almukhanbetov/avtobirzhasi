// Command import-locations seeds the regions/cities/districts reference
// tables (backend/migrations/00014_location_reference_tables.sql) with
// Kazakhstan's administrative-territorial structure, then backfills the
// existing free-text `region` column on listings/buyer_requests/users
// with the matching new region_id/city_id wherever an exact match
// exists. See docs/LOCATION_IMPLEMENTATION.md, Stage 3, for the full
// source citations and the reasoning behind this command's scope.
//
// Idempotent: reference rows are upserted by their unique `slug`
// (ON CONFLICT ... DO UPDATE) — re-running never creates duplicates, only
// refreshes name_ru/name_kz/kind/parent if this file's data changed. The
// backfill only ever touches rows where city_id is still NULL, and never
// writes to `region` itself — re-running it is a no-op for rows already
// backfilled (by this command or by hand) and never overwrites a value.
//
// Source: Bureau of National Statistics, Agency for Strategic Planning
// and Reforms of the Republic of Kazakhstan — "Административно-
// территориальные единицы Республики Казахстан" (as of 1 January 2026),
// https://stat.gov.kz/ru/industries/social-statistics/demography/publications/476642/
// — region names and the post-2022-reform count (17 oblasts + 3 cities of
// republican significance: Astana, Almaty, Shymkent). Administrative-
// center cities cross-checked against
// https://ru.wikipedia.org/wiki/Административное_деление_Казахстана.
// Almaty's 8 urban districts confirmed via the same Wikipedia article's
// "Административно-территориальное деление Алма-Аты" page; Astana's 5
// (Есиль, Сарыарка, Алматы, Байконыр, Нура) and Shymkent's 5 (Абайский,
// Аль-Фарабийский, Енбекшинский, Каратауский, Туранский) districts
// confirmed via 2025–2026 reporting on their district reorganizations
// (adilet.zan.kz decree V22E0028880 for Shymkent's 5th district;
// krisha.kz/inform.kz coverage of Astana's 2026 district boundary
// changes).
//
// Stage 3B added every remaining city of Kazakhstan (see the second half
// of the `cities` slice below, its own source comment, and
// docs/LOCATION_IMPLEMENTATION.md Stage 3B). The official full KATO data
// tables (per-object codes and the 195 administrative/rural districts of
// the oblasts) remain out of reach: the data.egov.kz "kato" dataset is
// gated behind an API key this environment doesn't have (confirmed: every
// unauthenticated request returns 403), and the downloadable archive on
// stat.gov.kz (НК РК 11-2021) turned out to contain only the classifier's
// title page and methodology, not its 427 pages of data tables. Left
// NULL/absent rather than guessed — see Stage 3B's "open item" section.
package main

import (
	"context"
	"fmt"
	"log"
	"strings"

	"avtobirzhasi/backend/internal/config"
	"avtobirzhasi/backend/internal/db"

	"github.com/jackc/pgx/v5/pgxpool"
)

type region struct {
	Slug   string
	NameRU string
	NameKZ string
	Kind   string // oblast | republican_city
}

type city struct {
	Slug       string
	NameRU     string
	NameKZ     string
	RegionSlug string
}

type district struct {
	Slug       string
	NameRU     string
	NameKZ     string
	Kind       string // administrative | urban
	ParentSlug string // a region slug (administrative) or a city slug (urban)
}

var regions = []region{
	{"akmola", "Акмолинская область", "Ақмола облысы", "oblast"},
	{"aktobe", "Актюбинская область", "Ақтөбе облысы", "oblast"},
	{"almaty-region", "Алматинская область", "Алматы облысы", "oblast"},
	{"atyrau", "Атырауская область", "Атырау облысы", "oblast"},
	{"west-kazakhstan", "Западно-Казахстанская область", "Батыс Қазақстан облысы", "oblast"},
	{"zhambyl", "Жамбылская область", "Жамбыл облысы", "oblast"},
	{"karaganda", "Карагандинская область", "Қарағанды облысы", "oblast"},
	{"kostanay", "Костанайская область", "Қостанай облысы", "oblast"},
	{"kyzylorda", "Кызылординская область", "Қызылорда облысы", "oblast"},
	{"mangystau", "Мангистауская область", "Маңғыстау облысы", "oblast"},
	{"pavlodar", "Павлодарская область", "Павлодар облысы", "oblast"},
	{"north-kazakhstan", "Северо-Казахстанская область", "Солтүстік Қазақстан облысы", "oblast"},
	{"turkistan", "Туркестанская область", "Түркістан облысы", "oblast"},
	{"east-kazakhstan", "Восточно-Казахстанская область", "Шығыс Қазақстан облысы", "oblast"},
	{"abai-region", "Абайская область", "Абай облысы", "oblast"},
	{"jetisu", "Жетысуская область", "Жетісу облысы", "oblast"},
	{"ulytau", "Улытауская область", "Ұлытау облысы", "oblast"},
	{"astana", "город Астана", "Астана қаласы", "republican_city"},
	{"almaty", "город Алматы", "Алматы қаласы", "republican_city"},
	{"shymkent", "город Шымкент", "Шымкент қаласы", "republican_city"},
}

// One administrative-center city per oblast, plus the city itself for
// each of the 3 republican-significance regions — a republican-city
// region's `cities` row is what listings/buyer_requests/users actually
// point at via city_id, keeping every location at the same granularity
// (see docs/LOCATION_IMPLEMENTATION.md section 6.2).
var cities = []city{
	{"kokshetau", "Кокшетау", "Көкшетау", "akmola"},
	{"aktobe", "Актобе", "Ақтөбе", "aktobe"},
	{"konaev", "Конаев", "Қонаев", "almaty-region"},
	{"atyrau", "Атырау", "Атырау", "atyrau"},
	{"uralsk", "Уральск", "Орал", "west-kazakhstan"},
	{"taraz", "Тараз", "Тараз", "zhambyl"},
	{"karaganda", "Караганда", "Қарағанды", "karaganda"},
	{"kostanay", "Костанай", "Қостанай", "kostanay"},
	{"kyzylorda", "Кызылорда", "Қызылорда", "kyzylorda"},
	{"aktau", "Актау", "Ақтау", "mangystau"},
	{"pavlodar", "Павлодар", "Павлодар", "pavlodar"},
	{"petropavlovsk", "Петропавловск", "Петропавл", "north-kazakhstan"},
	{"turkistan", "Туркестан", "Түркістан", "turkistan"},
	{"ust-kamenogorsk", "Усть-Каменогорск", "Өскемен", "east-kazakhstan"},
	{"semey", "Семей", "Семей", "abai-region"},
	{"taldykorgan", "Талдыкорган", "Талдықорған", "jetisu"},
	{"zhezkazgan", "Жезказган", "Жезқазған", "ulytau"},
	{"astana", "Астана", "Астана", "astana"},
	{"almaty", "Алматы", "Алматы", "almaty"},
	{"shymkent", "Шымкент", "Шымкент", "shymkent"},

	// Stage 3B: every other city of Kazakhstan (beyond the 20 administrative
	// centers / republican cities above) — Source: ru.wikipedia.org
	// "Города Казахстана" (city list with 2025/2026 population figures),
	// fetched 2026-09-20, cross-checked against the post-2022 regional
	// reform (Ayagoz reassigned Vostochno-Kazakhstanskaya -> Abai; Zharkent/
	// Tekeli/Usharal/Ushtobe/Sarkand reassigned Almatinskaya -> Jetisu; the
	// source's own list duplicated these under both the old and new region
	// and mistakenly listed Shymkent under Turkistan — corrected here to the
	// single post-reform region each belongs to, Shymkent excluded (already
	// its own republican-city region above, not a Turkistan city).
	//
	// name_kz: filled with the standard Kazakh form where confidently
	// known; where a distinct official form could not be confirmed, RU is
	// reused as a safe placeholder rather than guessing — these are marked
	// in docs/LOCATION_IMPLEMENTATION.md Stage 3B as needing a future
	// verification pass, not asserted as final.
	//
	// Does NOT distinguish "город областного значения" vs "город
	// районного значения" (that legal classification isn't in this
	// source and the schema has no column for it — see Stage 3B notes).
	{"ayagoz", "Аягоз", "Аягөз", "abai-region"},
	{"kurchatov", "Курчатов", "Курчатов", "abai-region"},
	{"charsk", "Чарск", "Чарск", "abai-region"},

	{"stepnogorsk", "Степногорск", "Степногорск", "akmola"},
	{"shchuchinsk", "Щучинск", "Щучинск", "akmola"},
	{"kosshy", "Косшы", "Қосшы", "akmola"},
	{"atbasar", "Атбасар", "Атбасар", "akmola"},
	{"makinsk", "Макинск", "Макинск", "akmola"},
	{"akkol", "Акколь", "Ақкөл", "akmola"},
	{"esil-akmola", "Есиль", "Есіл", "akmola"},
	{"ereymentau", "Ерейментау", "Ерейментау", "akmola"},
	{"derzhavinsk", "Державинск", "Державинск", "akmola"},
	{"stepnyak", "Степняк", "Степняк", "akmola"},

	{"kandyagash", "Кандыагаш", "Қандыағаш", "aktobe"},
	{"khromtau", "Хромтау", "Хромтау", "aktobe"},
	{"shalkar", "Шалкар", "Шалқар", "aktobe"},
	{"alga", "Алга", "Алға", "aktobe"},
	{"emba", "Эмба", "Ембі", "aktobe"},
	{"temir", "Темир", "Темір", "aktobe"},
	{"zhem", "Жем", "Жем", "aktobe"},

	{"kaskelen", "Каскелен", "Қаскелең", "almaty-region"},
	{"talgar", "Талгар", "Талғар", "almaty-region"},
	{"alatau-city", "Алатау", "Алатау", "almaty-region"},
	{"esik", "Есик", "Есік", "almaty-region"},

	{"kulsary", "Кульсары", "Құлсары", "atyrau"},

	{"ridder", "Риддер", "Риддер", "east-kazakhstan"},
	{"altai-city", "Алтай", "Алтай", "east-kazakhstan"},
	{"shemonaikha", "Шемонаиха", "Шемонаиха", "east-kazakhstan"},
	{"zaysan", "Зайсан", "Зайсан", "east-kazakhstan"},
	{"serebryansk", "Серебрянск", "Серебрянск", "east-kazakhstan"},

	{"shu", "Шу", "Шу", "zhambyl"},
	{"karatau", "Каратау", "Қаратау", "zhambyl"},
	{"zhanatas", "Жанатас", "Жаңатас", "zhambyl"},

	{"zharkent", "Жаркент", "Жаркент", "jetisu"},
	{"tekeli", "Текели", "Текелі", "jetisu"},
	{"usharal", "Ушарал", "Үшарал", "jetisu"},
	{"ushtobe", "Уштобе", "Үштөбе", "jetisu"},
	{"sarkand", "Сарканд", "Сарқанд", "jetisu"},

	{"aksai", "Аксай", "Ақсай", "west-kazakhstan"},

	{"temirtau", "Темиртау", "Теміртау", "karaganda"},
	{"balkhash", "Балхаш", "Балқаш", "karaganda"},
	{"abai-city", "Абай", "Абай", "karaganda"},
	{"shakhtinsk", "Шахтинск", "Шахтинск", "karaganda"},
	{"saran", "Сарань", "Сарань", "karaganda"},
	{"priozersk", "Приозёрск", "Приозёрск", "karaganda"},
	{"karkaralinsk", "Каркаралинск", "Қарқаралы", "karaganda"},

	{"rudny", "Рудный", "Рудный", "kostanay"},
	{"lisakovsk", "Лисаковск", "Лисаковск", "kostanay"},
	{"zhitikara", "Житикара", "Жітіқара", "kostanay"},
	{"arkalyk", "Аркалык", "Арқалық", "kostanay"},
	{"tobyl", "Тобыл", "Тобыл", "kostanay"},

	{"aralsk", "Аральск", "Арал", "kyzylorda"},
	{"baikonur", "Байконур", "Байқоңыр", "kyzylorda"},
	{"kazalinsk", "Казалинск", "Қазалы", "kyzylorda"},

	{"fort-shevchenko", "Форт-Шевченко", "Форт-Шевченко", "mangystau"},

	{"ekibastuz", "Экибастуз", "Екібастұз", "pavlodar"},
	{"aksu", "Аксу", "Ақсу", "pavlodar"},

	{"tayynsha", "Тайынша", "Тайынша", "north-kazakhstan"},
	{"bulaevo", "Булаево", "Булаево", "north-kazakhstan"},
	{"sergeyevka", "Сергеевка", "Сергеевка", "north-kazakhstan"},
	{"mamlyutka", "Мамлютка", "Мамлютка", "north-kazakhstan"},

	{"kentau", "Кентау", "Кентау", "turkistan"},
	{"saryagash", "Сарыагаш", "Сарыағаш", "turkistan"},
	{"arys", "Арыс", "Арыс", "turkistan"},
	{"zhetysay", "Жетысай", "Жетісай", "turkistan"},
	{"lenger", "Ленгер", "Ленгер", "turkistan"},
	{"shardara", "Шардара", "Шардара", "turkistan"},

	{"satpayev", "Сатпаев", "Сәтбаев", "ulytau"},
	{"karazhal", "Каражал", "Қаражал", "ulytau"},
}

var districts = []district{
	{"almaty-alatau", "Алатауский район", "Алатау ауданы", "urban", "almaty"},
	{"almaty-almaly", "Алмалинский район", "Алмалы ауданы", "urban", "almaty"},
	{"almaty-auezov", "Ауэзовский район", "Әуезов ауданы", "urban", "almaty"},
	{"almaty-bostandyk", "Бостандыкский район", "Бостандық ауданы", "urban", "almaty"},
	{"almaty-zhetysu", "Жетысуский район", "Жетісу ауданы", "urban", "almaty"},
	{"almaty-medeu", "Медеуский район", "Медеу ауданы", "urban", "almaty"},
	{"almaty-nauryzbai", "Наурызбайский район", "Наурызбай ауданы", "urban", "almaty"},
	{"almaty-turksib", "Турксибский район", "Түрксіб ауданы", "urban", "almaty"},
	{"astana-almaty", "район Алматы", "Алматы ауданы", "urban", "astana"},
	{"astana-baikonyr", "район Байконыр", "Байқоңыр ауданы", "urban", "astana"},
	{"astana-esil", "район Есиль", "Есіл ауданы", "urban", "astana"},
	{"astana-nura", "район Нура", "Нұра ауданы", "urban", "astana"},
	{"astana-saryarka", "район Сарыарка", "Сарыарқа ауданы", "urban", "astana"},
	{"shymkent-abai", "Абайский район", "Абай ауданы", "urban", "shymkent"},
	{"shymkent-al-farabi", "Аль-Фарабийский район", "Әл-Фараби ауданы", "urban", "shymkent"},
	{"shymkent-enbekshi", "Енбекшинский район", "Еңбекші ауданы", "urban", "shymkent"},
	{"shymkent-karatau", "Каратауский район", "Қаратау ауданы", "urban", "shymkent"},
	{"shymkent-turan", "Туранский район", "Туран ауданы", "urban", "shymkent"},
}

// backfillTables are the existing free-text `region` columns this
// command reconciles against the new reference data — a fixed,
// code-controlled list, never user input (it is interpolated into SQL
// below only for this reason).
var backfillTables = []string{"listings", "buyer_requests", "users"}

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer pool.Close()

	regionIDs := upsertRegions(ctx, pool)
	cityIDs := upsertCities(ctx, pool, regionIDs)
	upsertDistricts(ctx, pool, regionIDs, cityIDs)
	fmt.Printf("reference data: %d regions, %d cities, %d districts upserted\n",
		len(regions), len(cities), len(districts))

	fmt.Println("backfill (region text -> region_id/city_id):")
	for _, table := range backfillTables {
		report(ctx, pool, table)
	}
}

func upsertRegions(ctx context.Context, pool *pgxpool.Pool) map[string]string {
	ids := make(map[string]string, len(regions))
	for _, r := range regions {
		var id string
		err := pool.QueryRow(ctx, `
			INSERT INTO regions (name_ru, name_kz, slug, kind)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (slug) DO UPDATE SET
				name_ru = EXCLUDED.name_ru, name_kz = EXCLUDED.name_kz, kind = EXCLUDED.kind
			RETURNING id
		`, r.NameRU, r.NameKZ, r.Slug, r.Kind).Scan(&id)
		if err != nil {
			log.Fatalf("upsert region %q: %v", r.Slug, err)
		}
		ids[r.Slug] = id
	}
	return ids
}

func upsertCities(ctx context.Context, pool *pgxpool.Pool, regionIDs map[string]string) map[string]string {
	ids := make(map[string]string, len(cities))
	for _, c := range cities {
		regionID, ok := regionIDs[c.RegionSlug]
		if !ok {
			log.Fatalf("city %q references unknown region slug %q", c.Slug, c.RegionSlug)
		}
		var id string
		err := pool.QueryRow(ctx, `
			INSERT INTO cities (region_id, name_ru, name_kz, slug)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (slug) DO UPDATE SET
				region_id = EXCLUDED.region_id, name_ru = EXCLUDED.name_ru, name_kz = EXCLUDED.name_kz
			RETURNING id
		`, regionID, c.NameRU, c.NameKZ, c.Slug).Scan(&id)
		if err != nil {
			log.Fatalf("upsert city %q: %v", c.Slug, err)
		}
		ids[c.Slug] = id
	}
	return ids
}

func upsertDistricts(ctx context.Context, pool *pgxpool.Pool, regionIDs, cityIDs map[string]string) {
	for _, d := range districts {
		var regionID, cityID *string
		switch d.Kind {
		case "administrative":
			id, ok := regionIDs[d.ParentSlug]
			if !ok {
				log.Fatalf("district %q references unknown region slug %q", d.Slug, d.ParentSlug)
			}
			regionID = &id
		case "urban":
			id, ok := cityIDs[d.ParentSlug]
			if !ok {
				log.Fatalf("district %q references unknown city slug %q", d.Slug, d.ParentSlug)
			}
			cityID = &id
		default:
			log.Fatalf("district %q has unknown kind %q", d.Slug, d.Kind)
		}
		_, err := pool.Exec(ctx, `
			INSERT INTO districts (kind, region_id, city_id, name_ru, name_kz, slug)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (slug) DO UPDATE SET
				kind = EXCLUDED.kind, region_id = EXCLUDED.region_id, city_id = EXCLUDED.city_id,
				name_ru = EXCLUDED.name_ru, name_kz = EXCLUDED.name_kz
		`, d.Kind, regionID, cityID, d.NameRU, d.NameKZ, d.Slug)
		if err != nil {
			log.Fatalf("upsert district %q: %v", d.Slug, err)
		}
	}
}

// report backfills `table`'s region_id/city_id from an exact,
// case/whitespace-insensitive match against cities.name_ru — never a
// partial/ILIKE match, never touching rows that already have a city_id
// (idempotent), never writing to `region` — then prints how many rows
// matched vs. remain unmatched, with the distinct unmatched values so
// they can be reviewed by hand instead of guessed at.
func report(ctx context.Context, pool *pgxpool.Pool, table string) {
	tag, err := pool.Exec(ctx, fmt.Sprintf(`
		UPDATE %s AS t
		SET region_id = c.region_id, city_id = c.id
		FROM cities c
		WHERE t.city_id IS NULL
		  AND t.region IS NOT NULL
		  AND lower(trim(t.region)) = lower(trim(c.name_ru))
	`, table))
	if err != nil {
		log.Fatalf("backfill %s: %v", table, err)
	}

	var matched, unmatched int64
	if err := pool.QueryRow(ctx, fmt.Sprintf(
		`SELECT count(*) FROM %s WHERE region IS NOT NULL AND city_id IS NOT NULL`, table,
	)).Scan(&matched); err != nil {
		log.Fatalf("count matched %s: %v", table, err)
	}
	if err := pool.QueryRow(ctx, fmt.Sprintf(
		`SELECT count(*) FROM %s WHERE region IS NOT NULL AND city_id IS NULL`, table,
	)).Scan(&unmatched); err != nil {
		log.Fatalf("count unmatched %s: %v", table, err)
	}

	rows, err := pool.Query(ctx, fmt.Sprintf(
		`SELECT DISTINCT region FROM %s WHERE region IS NOT NULL AND city_id IS NULL ORDER BY region`, table,
	))
	if err != nil {
		log.Fatalf("list unmatched %s: %v", table, err)
	}
	defer rows.Close()
	var unmatchedValues []string
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			log.Fatalf("scan unmatched %s: %v", table, err)
		}
		unmatchedValues = append(unmatchedValues, v)
	}

	fmt.Printf("  %-15s newly matched this run: %-4d matched total: %-4d unmatched total: %-4d\n",
		table, tag.RowsAffected(), matched, unmatched)
	if len(unmatchedValues) > 0 {
		fmt.Printf("    unmatched region values: %s\n", strings.Join(unmatchedValues, ", "))
	}
}
