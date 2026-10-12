import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LinkButton, selectClass } from "./primitives";

type Select = { name: string; label: string; value?: string; options: Array<{ value: string; label: string }> };

/** GET form for searching and filtering a table. Works without JavaScript. */
export function FilterBar({
  q,
  placeholder,
  selects = [],
  clearHref,
  children,
}: {
  q?: string;
  placeholder?: string;
  selects?: Select[];
  clearHref: string;
  children?: React.ReactNode;
}) {
  const active = !!q || selects.some((s) => !!s.value);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <form className="flex flex-1 flex-wrap items-center gap-2" role="search">
        {placeholder && (
          <Input name="q" type="search" defaultValue={q ?? ""} placeholder={placeholder} aria-label={placeholder} className="w-full sm:w-64" />
        )}
        {selects.map((s) => (
          <select key={s.name} name={s.name} defaultValue={s.value ?? ""} aria-label={s.label} className={`${selectClass} w-auto`}>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ))}
        <Button type="submit" variant="outline">
          Filter
        </Button>
        {active && (
          <LinkButton href={clearHref} variant="ghost">
            Clear
          </LinkButton>
        )}
      </form>
      {children}
    </div>
  );
}
