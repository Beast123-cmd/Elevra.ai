import type { ModelCard } from "@/lib/types";

/** Metrics stored for a model or the baseline rule (superset of ModelCard["metrics"] as written by the pipeline). */
export interface EvalMetrics {
  auc: number; precision: number; recall: number; f1: number;
  cv_auc?: number; pr_auc?: number; brier?: number; threshold?: number;
  confusion?: { tp: number; fp: number; tn: number; fn: number };
}

/** analytics.model as the pipeline writes it: the shared ModelCard plus model-selection details. */
export interface ModelCardFull extends ModelCard {
  algorithm?: string;
  selection_method?: string;
  provenance?: string;
  candidates?: { name: string; metrics: EvalMetrics; configuration?: Record<string, unknown> }[];
}

export const MODEL_LABEL: Record<string, string> = {
  logistic_regression: "Logistic regression",
  decision_tree: "Decision tree",
  random_forest: "Random forest",
};
