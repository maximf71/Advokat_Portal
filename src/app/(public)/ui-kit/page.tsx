import { CityCategoryHeader } from "@/components/domain/CityCategoryHeader";
import { CourtCasesTable } from "@/components/domain/CourtCasesTable";
import { LawyerCard } from "@/components/domain/LawyerCard";
import { LegalCalculatorWidget } from "@/components/domain/LegalCalculatorWidget";
import { RatingBreakdownCard } from "@/components/domain/RatingBreakdownCard";
import { UnclaimedBanner } from "@/components/domain/UnclaimedBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const SECTIONS = [
  { id: "typography", label: "01. Типографика и палитра" },
  { id: "header", label: "02. Шапка гео-категории" },
  { id: "cards", label: "03. Карточки адвокатов" },
  { id: "table", label: "04. Таблица судебных дел" },
  { id: "rating", label: "05. Методика рейтинга" },
  { id: "calculator", label: "06. SEO-калькулятор" },
];

export default function UiKitPage() {
  return (
    <div className="space-y-10">
      <div className="border border-rule bg-surface p-5">
        <p className="section-kicker mb-2">Design system</p>
        <h1 className="font-serif text-3xl text-ink md:text-4xl">UI-Kit · Swiss Legal</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-ink">
          Эталонные блоки портала. После утверждения используйте только компоненты из{" "}
          <code className="font-mono text-xs">src/components/domain/</code>.
        </p>
        <nav className="mt-4 flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="border border-rule bg-paper px-3 py-1.5 text-xs hover:border-navy"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </div>

      <section id="typography" className="space-y-4">
        <h2 className="font-serif text-2xl">01. Типографика и палитра</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="border border-rule bg-surface p-4 space-y-2">
            <p className="font-serif text-3xl">PT Serif — заголовки</p>
            <p className="font-sans text-base">Golos Text — наборный текст и интерфейс</p>
            <p className="font-mono text-sm">JetBrains Mono — № 77/12458 · А40-18920/2025</p>
          </div>
          <div className="grid grid-cols-4 border border-rule">
            {[
              ["paper", "#F9F8F6"],
              ["navy", "#1B365D"],
              ["bronze", "#8C6D46"],
              ["green", "#1E5631"],
            ].map(([name, color]) => (
              <div key={name} className="border-r border-rule last:border-r-0">
                <div className="h-16" style={{ background: color }} />
                <div className="bg-surface p-2 text-[11px]">
                  <div className="uppercase tracking-wider text-muted-ink">{name}</div>
                  <div className="font-mono">{color}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Badge tone="green">ДЕЙСТВУЮЩИЙ</Badge>
          <Badge tone="bronze">Проверено</Badge>
        </div>
      </section>

      <section id="header" className="space-y-4">
        <h2 className="font-serif text-2xl">02. Шапка гео-категории</h2>
        <CityCategoryHeader
          breadcrumbs={[
            { label: "Главная", href: "/" },
            { label: "Свердловская область" },
            { label: "Екатеринбург", href: "/ekaterinburg" },
            { label: "Уголовное право" },
          ]}
          title="Адвокаты по уголовным делам в Екатеринбурге"
          stats={[
            { label: "В реестре города", value: "142" },
            { label: "Проанализировано актов", value: "3 840" },
            { label: "Средний индекс практики", value: "7.4 / 10" },
            { label: "Консультация от", value: "2 500 ₽" },
          ]}
          tags={[
            { label: "Ст. 159 УК РФ (Мошенничество)", count: 48, href: "#" },
            { label: "Ст. 228 УК РФ", count: 31, href: "#" },
            { label: "Экономические преступления", count: 19, href: "#" },
            { label: "УДО и обжалование приговора", count: 64, href: "#" },
          ]}
        />
      </section>

      <section id="cards" className="space-y-4">
        <h2 className="font-serif text-2xl">03. Карточки адвокатов</h2>
        <LawyerCard
          lawyer={{
            id: "demo-claimed",
            slug: "petrov-andrey-sergeevich-66-2841",
            fullName: "Петров Андрей Сергеевич",
            registryNumber: "66/2841",
            registryStatus: "ACTIVE",
            isClaimed: true,
            isVerifiedDocuments: true,
            experienceStartYear: 2011,
            lawFirmName: "Коллегия адвокатов «УралПраво»",
            totalRating: 9.2,
            practiceScore: 4.8,
            statusAndExpScore: 2.8,
            reputationScore: 1.6,
            casesCount: 60,
            minConsultationPrice: 3000,
            freeFirstCheck: true,
            specializations: ["Уголовное право", "Арбитраж"],
            courtHighlights: [
              "Свердловский областной суд (42 дела)",
              "Арбитражный суд УО (18 дел)",
            ],
            recentCases: [
              {
                caseNumber: "22-4102/2025",
                title: "Переквалификация и прекращение преследования",
                lawArticles: ["Ст. 159 ч. 4 УК РФ"],
                outcomeLabel: "Победа",
              },
              {
                caseNumber: "А60-34912/2025",
                title: "Взыскание задолженности по договору подряда",
                lawArticles: ["Ст. 395 ГК РФ"],
                outcomeLabel: "Частично",
              },
            ],
          }}
        />
        <LawyerCard
          lawyer={{
            id: "demo-unclaimed",
            slug: "smirnov-aleksey-sergeevich-66-9104",
            fullName: "Смирнов Алексей Сергеевич",
            registryNumber: "66/9104",
            registryStatus: "ACTIVE",
            isClaimed: false,
            experienceStartYear: 2015,
            totalRating: 6.8,
            practiceScore: 3.2,
            statusAndExpScore: 2.1,
            reputationScore: 0.5,
            casesCount: 27,
            specializations: ["Уголовное право"],
            recentCases: [
              {
                caseNumber: "1-142/2025",
                title: "Защита по обвинению в мошенничестве",
                lawArticles: ["Ст. 159 УК РФ"],
              },
            ],
          }}
        />
        <UnclaimedBanner
          lawyerName="Смирнов Алексей Сергеевич"
          claimHref="/claim/demo-unclaimed"
        />
      </section>

      <section id="table" className="space-y-4">
        <h2 className="font-serif text-2xl">04. Таблица судебных дел</h2>
        <CourtCasesTable
          cases={[
            {
              id: "1",
              slug: "delo-22-4102-2025",
              caseNumber: "22-4102/2025",
              courtName: "Свердловский областной суд",
              categoryName: "Уголовное право",
              lawArticles: ["ст. 159 ч. 4 УК РФ"],
              title: "Обжалование приговора",
              summary: "Переквалификация деяния, прекращение уголовного преследования.",
              outcome: "WIN",
              sourceUrl: "https://example.com",
            },
            {
              id: "2",
              slug: "delo-a60-34912-2025",
              caseNumber: "А60-34912/2025",
              courtName: "Арбитражный суд Свердловской области",
              categoryName: "Арбитраж",
              lawArticles: ["ст. 395 ГК РФ"],
              title: "Взыскание задолженности",
              summary: "Иск удовлетворён частично, проценты снижены судом.",
              outcome: "PARTIAL",
              sourceUrl: "https://example.com",
            },
          ]}
        />
      </section>

      <section id="rating" className="space-y-4">
        <h2 className="font-serif text-2xl">05. Методика рейтинга</h2>
        <div className="max-w-xl">
          <RatingBreakdownCard
            practiceScore={4.8}
            statusAndExpScore={2.8}
            reputationScore={1.6}
            totalRating={9.2}
          />
        </div>
      </section>

      <section id="calculator" className="space-y-4">
        <h2 className="font-serif text-2xl">06. SEO-калькулятор</h2>
        <LegalCalculatorWidget
          title="Калькулятор госпошлины в суд общей юрисдикции / Арбитраж (2026)"
          topLawyers={[
            { slug: "demo-1", fullName: "Петров А. С.", totalRating: 9.2 },
            { slug: "demo-2", fullName: "Волкова Е. И.", totalRating: 8.7 },
            { slug: "demo-3", fullName: "Сафин Р. М.", totalRating: 8.1 },
          ]}
        />
      </section>
    </div>
  );
}
