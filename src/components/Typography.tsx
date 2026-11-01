import type { HTMLAttributes, ReactNode } from "react";

function cx(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type HeadingProps = HTMLAttributes<HTMLHeadingElement> & { children: ReactNode };
type TextProps = HTMLAttributes<HTMLParagraphElement> & { children: ReactNode };
type SpanProps = HTMLAttributes<HTMLSpanElement> & { children: ReactNode };

export function Display({ className, children, ...props }: HeadingProps) {
  return <h1 {...props} className={cx("type-display", className)}>{children}</h1>;
}

export function H1({ className, children, ...props }: HeadingProps) {
  return <h1 {...props} className={cx("type-h1", className)}>{children}</h1>;
}

export function H2({ className, children, ...props }: HeadingProps) {
  return <h2 {...props} className={cx("type-h2", className)}>{children}</h2>;
}

export function H3({ className, children, ...props }: HeadingProps) {
  return <h3 {...props} className={cx("type-h3", className)}>{children}</h3>;
}

export function H4({ className, children, ...props }: HeadingProps) {
  return <h4 {...props} className={cx("type-h4", className)}>{children}</h4>;
}

export function H5({ className, children, ...props }: HeadingProps) {
  return <h5 {...props} className={cx("type-h5", className)}>{children}</h5>;
}

export function Eyebrow({ className, children, ...props }: TextProps) {
  return <p {...props} className={cx("type-eyebrow", className)}>{children}</p>;
}

export function Lead({ className, children, ...props }: TextProps) {
  return <p {...props} className={cx("type-lead", className)}>{children}</p>;
}

export function Body({ className, children, ...props }: TextProps) {
  return <p {...props} className={cx("type-body", className)}>{children}</p>;
}

export function BodySmall({ className, children, ...props }: TextProps) {
  return <p {...props} className={cx("type-body-sm", className)}>{children}</p>;
}

export function Caption({ className, children, ...props }: TextProps) {
  return <p {...props} className={cx("type-caption", className)}>{children}</p>;
}

export function StatValue({ className, children, ...props }: TextProps) {
  return <p {...props} className={cx("type-stat-value", className)}>{children}</p>;
}

export function Technical({ className, children, ...props }: SpanProps) {
  return <span {...props} className={cx("type-technical", className)}>{children}</span>;
}

export function Reading({ className, children, ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return <article {...props} className={cx("reading-prose", className)}>{children}</article>;
}
