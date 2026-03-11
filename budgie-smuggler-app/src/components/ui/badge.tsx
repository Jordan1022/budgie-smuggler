import { clsx } from "clsx";

type BadgeProps = {
  tone?: "info" | "warn" | "danger";
  children: React.ReactNode;
};

export function Badge({ tone = "info", children }: BadgeProps) {
  return (
    <span
      className={clsx("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", {
        "bg-blue-100 text-blue-700": tone === "info",
        "bg-amber-100 text-amber-700": tone === "warn",
        "bg-red-100 text-red-700": tone === "danger",
      })}
    >
      {children}
    </span>
  );
}
