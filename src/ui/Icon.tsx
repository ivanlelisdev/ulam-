import type { SVGProps } from "react";
const paths: Record<string, string> = {
  recipes:
    "M4 4h6c2 0 2 1 2 2v15c0-2-2-3-4-3H4z M20 4h-6c-2 0-2 1-2 2v15c0-2 2-3 4-3h4z",
  plan: "M5 5h14v15H5z M8 2v6 M16 2v6 M5 10h14 M8 14h2 M14 14h2",
  templates: "M7 3h13v15 M4 6h13v15H4z M7 10h7 M7 14h7 M7 18h4",
  groceries: "M3 8h18l-2 12H5z M8 8l4-6 4 6 M9 12v4 M15 12v4",
  settings:
    "M9 3h6l1 4 4 1v8l-4 1-1 4H9l-1-4-4-1V8l4-1z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  plus: "M12 5v14 M5 12h14",
  back: "M15 5l-7 7 7 7",
  next: "M9 5l7 7-7 7",
  clock: "M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  edit: "M4 16l12-12 4 4L8 20H4z M13 7l4 4",
  cook: "M7 10C0 10 3 2 8 5c1-5 7-5 8 0 5-3 8 5 1 5v9H7z M7 15h10",
  search: "M17 17l4 4 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  check: "M4 12l5 5L20 6",
  close: "M6 6l12 12 M6 18L18 6",
  remove: "M5 7h14 M9 7V4h6v3 M7 7l1 14h8l1-14",
  plate: "M3 12h18 M4 16h16 M7 12a5 5 0 0 1 10 0 M12 5V3",
};
export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="22"
      height="22"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.recipes} />
    </svg>
  );
}
