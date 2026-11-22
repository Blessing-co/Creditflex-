/* MODEL: totals for the Collections and Analytics pages. */
const Summary = {
  collections: (from, to) => sb.rpc("collection_summary", { p_from: from, p_to: to }),
  portfolio: () => sb.rpc("portfolio_summary")
};
