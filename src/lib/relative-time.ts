const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function startOfDay(date: Date): number {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

/** Datas relativas em português do Brasil: "agora", "há 5 min", "ontem". */
export function formatRelativePt(input: Date | string | number, now = new Date()): string {
  const date = input instanceof Date ? input : new Date(input);
  const time = date.getTime();
  if (Number.isNaN(time)) return "";

  const diff = now.getTime() - time;
  if (diff < 45_000) return "agora";

  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / DAY);
  if (dayDiff <= 0 && diff < 60 * MINUTE) {
    const mins = Math.max(1, Math.round(diff / MINUTE));
    return `há ${mins} min`;
  }
  if (dayDiff <= 0) {
    const hours = Math.max(1, Math.round(diff / (60 * MINUTE)));
    return `há ${hours} h`;
  }
  if (dayDiff === 1) return "ontem";
  if (dayDiff < 7) return `há ${dayDiff} dias`;

  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

export function joinedLabel(input: Date | string | number, now = new Date()): string {
  const label = formatRelativePt(input, now);
  if (!label) return "";
  if (label.startsWith("há") || label === "agora" || label === "ontem") {
    return `Entrou ${label}`;
  }
  return `Entrou em ${label}`;
}
