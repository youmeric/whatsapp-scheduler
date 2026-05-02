"use client"

import { Fragment } from "react"
import { cn } from "@/lib/utils"

/**
 * Renders a string with WhatsApp-style formatting:
 *  - *bold*       → <strong>
 *  - _italic_     → <em>
 *  - ~strike~     → <s>
 *  - ```mono```   → <code>
 *  - > quote      → <blockquote> (only at start of line)
 *
 * Inline markers must wrap a non-empty span and be bordered by non-word chars
 * (or start/end-of-line) on the outside, and non-space on the inside — matches
 * WhatsApp's lenient-but-not-greedy parsing.
 */

type Token =
  | { kind: "text"; value: string }
  | { kind: "bold"; children: Token[] }
  | { kind: "italic"; children: Token[] }
  | { kind: "strike"; children: Token[] }
  | { kind: "mono"; value: string }

const INLINE_MARKERS: Record<"*" | "_" | "~", "bold" | "italic" | "strike"> = {
  "*": "bold",
  _: "italic",
  "~": "strike",
}

function tokenize(input: string): Token[] {
  const out: Token[] = []
  let i = 0

  while (i < input.length) {
    // Mono first (longest marker).
    if (input.startsWith("```", i)) {
      const end = input.indexOf("```", i + 3)
      if (end !== -1) {
        out.push({ kind: "mono", value: input.slice(i + 3, end) })
        i = end + 3
        continue
      }
    }

    const ch = input[i] as "*" | "_" | "~"
    if (ch === "*" || ch === "_" || ch === "~") {
      // Match the closing marker on the same logical run, with the
      // "non-space inside, non-word outside" rule.
      const prev = i === 0 ? "" : input[i - 1]
      const next = input[i + 1] ?? ""
      const startOk = !prev || /\s|[^A-Za-z0-9]/.test(prev)
      const innerStartOk = next && next !== " " && next !== ch
      if (startOk && innerStartOk) {
        // Look for matching close.
        let j = i + 1
        while (j < input.length) {
          if (input[j] === ch) {
            const before = input[j - 1]
            const after = input[j + 1] ?? ""
            const innerEndOk = before && before !== " " && before !== ch
            const endOk = !after || /\s|[^A-Za-z0-9]/.test(after)
            if (innerEndOk && endOk) {
              const inner = input.slice(i + 1, j)
              out.push({
                kind: INLINE_MARKERS[ch],
                children: tokenize(inner),
              })
              i = j + 1
              break
            }
          }
          j++
        }
        if (j >= input.length) {
          // No close found — emit raw char.
          out.push({ kind: "text", value: ch })
          i++
        }
        continue
      }
    }

    // Plain text: scan to next potential marker.
    let j = i
    while (j < input.length) {
      const c = input[j]
      if (c === "*" || c === "_" || c === "~") break
      if (input.startsWith("```", j)) break
      j++
    }
    if (j > i) {
      out.push({ kind: "text", value: input.slice(i, j) })
      i = j
    } else {
      // safety: avoid infinite loop
      out.push({ kind: "text", value: input[i] })
      i++
    }
  }

  return out
}

function renderTokens(tokens: Token[]): React.ReactNode {
  return tokens.map((t, idx) => {
    switch (t.kind) {
      case "text":
        return <Fragment key={idx}>{t.value}</Fragment>
      case "bold":
        return <strong key={idx}>{renderTokens(t.children)}</strong>
      case "italic":
        return <em key={idx}>{renderTokens(t.children)}</em>
      case "strike":
        return <s key={idx}>{renderTokens(t.children)}</s>
      case "mono":
        return (
          <code
            key={idx}
            className="rounded bg-muted px-1 py-px font-mono text-[0.9em]"
          >
            {t.value}
          </code>
        )
    }
  })
}

function renderLine(line: string, idx: number): React.ReactNode {
  if (line.startsWith("> ")) {
    return (
      <blockquote
        key={idx}
        className="my-1 border-l-2 border-emerald-600/60 pl-2 text-emerald-900 dark:text-emerald-200/90"
      >
        {renderTokens(tokenize(line.slice(2)))}
      </blockquote>
    )
  }
  if (line === "") {
    return <br key={idx} />
  }
  return <div key={idx}>{renderTokens(tokenize(line))}</div>
}

export function WhatsappPreview({
  value,
  className,
  placeholder = "Aperçu vide…",
}: {
  value: string
  className?: string
  placeholder?: string
}) {
  const lines = value.split("\n")
  const isEmpty = value.trim().length === 0

  // WhatsApp-ish bubble: pale green on light, darker on dark; sent timestamp.
  const now = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date())

  return (
    <div
      className={cn(
        "rounded-lg p-3 text-sm leading-relaxed",
        "bg-[#dcf8c6] text-zinc-900",
        "dark:bg-emerald-900/40 dark:text-zinc-100",
        "shadow-sm whitespace-pre-wrap break-words",
        className
      )}
      aria-label="Aperçu WhatsApp"
    >
      {isEmpty ? (
        <span className="italic opacity-60">{placeholder}</span>
      ) : (
        <>
          <div className="space-y-0.5">{lines.map(renderLine)}</div>
          <div className="mt-1 flex justify-end text-[10px] text-zinc-700/70 dark:text-zinc-300/70 tabular-nums">
            {now}
          </div>
        </>
      )}
    </div>
  )
}
