import type React from "react";

/**
 * C1 Chat Layout - Removes default padding to allow C1Chat full viewport
 *
 * This layout overrides the root layout's main element styling
 * to prevent the chat input from being cut off by pb-24 padding.
 */
export default function C1ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        /* Override root layout main element for C1 chat */
        main.flex-1 {
          padding-bottom: 0 !important;
        }
      `}</style>
      {children}
    </>
  );
}
