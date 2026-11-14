function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink">{label}</span>
        <span className="font-mono text-xs tabular-nums text-muted-ink">
          {value.toFixed(1)} / {max.toFixed(1)}
        </span>
      </div>
      <div className="h-1 w-full bg-rule">
        <div className="h-1 bg-navy" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function RatingBreakdownCard({
  practiceScore,
  statusAndExpScore,
  reputationScore,
  totalRating,
}: {
  practiceScore: number;
  statusAndExpScore: number;
  reputationScore: number;
  totalRating: number;
}) {
  return (
    <section className="border border-rule bg-surface p-5">
      <p className="section-kicker mb-2">Методика рейтинга</p>
      <div className="mb-5 flex items-baseline gap-2">
        <span className="font-serif text-4xl tabular-nums text-ink">
          {totalRating.toFixed(1)}
        </span>
        <span className="text-sm text-muted-ink">/ 10</span>
      </div>
      <div className="space-y-4">
        <Bar
          value={practiceScore}
          max={5}
          label="Индекс судебной практики"
        />
        <Bar
          value={statusAndExpScore}
          max={3}
          label="Квалификация и статус Минюста"
        />
        <Bar
          value={reputationScore}
          max={2}
          label="Репутация и активность"
        />
      </div>
      <p className="mt-5 text-xs leading-relaxed text-muted-ink">
        Рейтинг строится по открытым данным судов и реестра Минюста. Максимум доступен после
        верификации профиля, заполнения прайса и ответов в разделе «Вопрос–ответ».
      </p>
    </section>
  );
}
