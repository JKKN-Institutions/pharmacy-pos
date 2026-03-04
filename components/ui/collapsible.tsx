"use client"

import { Collapsible as CollapsiblePrimitive } from "radix-ui"

function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      // Radix's @radix-ui/react-id uses useState(React.useId()) which generates
      // different ID formats between SSR (counter-based) and client hydration
      // (tree-based). The aria-controls attribute always renders in HTML,
      // so we suppress the mismatch warning here.
      suppressHydrationWarning
      {...props}
    />
  )
}

function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      // Same Radix useId() SSR/hydration format mismatch — id attribute on the
      // content div needs suppression.
      suppressHydrationWarning
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
