// Life Insurance Components
// Complete React component library for Back9 Insurance integration

export { LifeInsuranceTab } from "./LifeInsuranceTab";
export { InstantQuoteWidget } from "./InstantQuoteWidget";
export { QuoteForm } from "./QuoteForm";
export { QuoteResults } from "./QuoteResults";
export { AICrossSellCard } from "./AICrossSellCard";
export { QuoteHistory } from "./QuoteHistory";

// Re-export types for convenience
export type {
  LifeInsuranceTabProps,
  InstantQuoteWidgetProps,
  QuoteFormProps,
  QuoteResultsProps,
  AICrossSellCardProps,
  QuoteHistoryProps,
  CustomerProfileData,
  QuoteRequestParams,
  QuoteResponse,
  QuoteDetails,
  QuoteHistoryItem,
  AICrossSellOpportunity,
} from "@/types/lifeInsurance.types";
