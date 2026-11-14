import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { UnclaimedBanner } from "@/components/domain/UnclaimedBanner";
import { experienceYears, formatNumber, formatPrice, initialsFromName } from "@/lib/utils";

export type LawyerCardCase = {
  caseNumber: string;
  title: string;
  lawArticles?: string[];
  outcomeLabel?: string;
};

export type LawyerCardData = {
  id: string;
  slug: string;
  fullName: string;
  registryNumber?: string | null;
  registryStatus?: string | null;
  isClaimed: boolean;
  isVerifiedDocuments?: boolean;
  photoUrl?: string | null;
  experienceStartYear?: number | null;
  lawFirmName?: string | null;
  totalRating: number;
  practiceScore: number;
  statusAndExpScore: number;
  reputationScore: number;
  casesCount: number;
  minConsultationPrice?: number | null;
  freeFirstCheck?: boolean;
  specializations?: string[];
  courtHighlights?: string[];
  recentCases?: LawyerCardCase[];
};

export function LawyerCard({ lawyer }: { lawyer: LawyerCardData }) {
  const years = experienceYears(lawyer.experienceStartYear);
  const initials = initialsFromName(lawyer.fullName);
  const statusActive = !lawyer.registryStatus || lawyer.registryStatus === "ACTIVE";

  return (
    <article className="border border-rule bg-surface">
      <div className="grid md:grid-cols-[220px_1fr_260px]">
        {/* Left */}
        <div className="border-b border-rule p-4 md:border-b-0 md:border-r">
          {lawyer.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lawyer.photoUrl}
              alt={lawyer.fullName}
              className="aspect-[4/5] w-full border border-rule object-cover"
            />
          ) : (
            <div className="flex aspect-[4/5] w-full flex-col items-center justify-center border border-rule bg-[#EFECE6]">
              <span className="font-serif text-4xl text-ink">{initials}</span>
              <span className="mt-2 text-[11px] text-muted-ink">Фото не загружено</span>
            </div>
          )}
          <div className="mt-3 space-y-1">
            <div className="flex items-center gap-2 font-mono text-xs text-ink">
              <span
                className={`inline-block h-1.5 w-1.5 ${
                  statusActive ? "bg-registry-green" : "bg-muted-ink"
                }`}
              />
              {lawyer.registryNumber
                ? `Минюст РФ: № ${lawyer.registryNumber}`
                : "Реестровый номер не указан"}
            </div>
            <Badge tone={statusActive ? "green" : "muted"}>
              {statusActive ? "ДЕЙСТВУЮЩИЙ" : lawyer.registryStatus ?? "НЕИЗВЕСТНО"}
            </Badge>
            {(years !== null || lawyer.lawFirmName) && (
              <p className="pt-1 text-xs text-muted-ink">
                {years !== null && (
                  <>
                    Стаж с {lawyer.experienceStartYear} г. ({years} лет)
                  </>
                )}
                {years !== null && lawyer.lawFirmName && " • "}
                {lawyer.lawFirmName}
              </p>
            )}
          </div>
        </div>

        {/* Center */}
        <div className="border-b border-rule p-4 md:border-b-0 md:border-r">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/lawyers/${lawyer.slug}`}
              className="font-serif text-xl text-ink hover:text-navy"
            >
              {lawyer.fullName}
            </Link>
            {lawyer.isClaimed && lawyer.isVerifiedDocuments && (
              <Badge tone="bronze">Личность и диплом проверены</Badge>
            )}
          </div>

          {lawyer.specializations && lawyer.specializations.length > 0 && (
            <p className="mt-2 text-sm text-muted-ink">
              {lawyer.specializations.join(" · ")}
            </p>
          )}

          {lawyer.courtHighlights && lawyer.courtHighlights.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {lawyer.courtHighlights.map((c) => (
                <span key={c} className="border border-rule bg-paper px-2 py-1 text-xs">
                  {c}
                </span>
              ))}
            </div>
          )}

          {!lawyer.isClaimed && (
            <p className="mt-3 text-sm text-muted-ink">
              Найдено в ГАС «Правосудие»:{" "}
              <span className="font-mono tabular-nums text-ink">
                {formatNumber(lawyer.casesCount)} дел
              </span>
            </p>
          )}

          {lawyer.recentCases && lawyer.recentCases.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="section-kicker">Последние дела в базах судов</p>
              {lawyer.recentCases.slice(0, 2).map((c) => (
                <div
                  key={c.caseNumber}
                  className="border-l-2 border-navy bg-paper p-2.5 text-xs"
                >
                  <span className="font-mono text-navy">Дело № {c.caseNumber}</span>
                  {c.lawArticles && c.lawArticles.length > 0 && (
                    <span className="text-muted-ink"> • {c.lawArticles.join(", ")}</span>
                  )}
                  <div className="mt-1 text-ink">
                    {c.title}
                    {c.outcomeLabel ? ` • Итог: ${c.outcomeLabel}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right */}
        <div className="bg-[#FAF9F5] p-4">
          <div className="flex items-baseline gap-1">
            <span className="font-serif text-3xl tabular-nums text-ink">
              {lawyer.totalRating.toFixed(1)}
            </span>
            <span className="text-sm text-muted-ink">/ 10</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-ink">
            {lawyer.isClaimed
              ? `Практика: ${lawyer.practiceScore.toFixed(1)}/5 • Статус: ${lawyer.statusAndExpScore.toFixed(1)}/3 • Отзывы: ${lawyer.reputationScore.toFixed(1)}/2`
              : "Расчёт по открытым данным судов"}
          </p>

          <div className="mt-4 space-y-1 text-sm">
            {lawyer.minConsultationPrice != null ? (
              <p>
                Консультация:{" "}
                <span className="font-mono tabular-nums">
                  от {formatPrice(lawyer.minConsultationPrice)}
                </span>
              </p>
            ) : (
              <p className="text-muted-ink">Прайс не заполнен</p>
            )}
            {lawyer.freeFirstCheck && (
              <p className="text-registry-green">Первичная оценка дела: Бесплатно</p>
            )}
          </div>

          <div className="mt-5 space-y-2">
            {lawyer.isClaimed ? (
              <>
                <Link
                  href={`/lawyers/${lawyer.slug}#lead`}
                  className="block w-full bg-navy px-3 py-3 text-center text-sm font-medium leading-snug text-white hover:bg-[#152a4a]"
                >
                  Записаться / Обсудить дело
                </Link>
                <Link
                  href={`/lawyers/${lawyer.slug}#contacts`}
                  className="block w-full border border-rule bg-surface px-3 py-3 text-center text-sm leading-snug hover:border-navy"
                >
                  Показать телефон
                </Link>
              </>
            ) : (
              <>
                <Link
                  href={`/lawyers/${lawyer.slug}#lead`}
                  className="block w-full bg-navy px-3 py-3 text-center text-sm font-medium leading-snug text-white hover:bg-[#152a4a]"
                >
                  Оставить заявку
                </Link>
                <Link
                  href={`/claim/${lawyer.id}`}
                  className="block w-full border border-rule bg-surface px-3 py-3 text-center text-sm leading-snug hover:border-navy"
                >
                  Подтвердить профиль
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {!lawyer.isClaimed && (
        <UnclaimedBanner
          lawyerName={lawyer.fullName}
          claimHref={`/claim/${lawyer.id}`}
        />
      )}
    </article>
  );
}
