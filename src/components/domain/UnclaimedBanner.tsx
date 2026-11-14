import Link from "next/link";

export function UnclaimedBanner({
  lawyerName,
  claimHref,
}: {
  lawyerName: string;
  claimHref: string;
}) {
  return (
    <div className="flex flex-col gap-2 border border-rule bg-[#F4EFE6] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink">
        Профиль сформирован по открытым данным Минюста и ГАС «Правосудие». Вы являетесь
        адвокатом <span className="font-medium">{lawyerName}</span>?
      </p>
      <Link
        href={claimHref}
        className="shrink-0 text-sm font-medium text-navy underline-offset-4 hover:underline"
      >
        Подтвердить профиль →
      </Link>
    </div>
  );
}
