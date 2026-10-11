export interface SourceStat {
  source: string;
  file: string;
  id_format: string;
  rows_in: number;
  rows_out: number;
  students_covered_pct: number;
}

export interface DataQualityRow {
  id: number;
  source: string;
  issue: string;
  rows_affected: number;
  action: string;
}

export interface DataHealthData {
  sources: SourceStat[];
  quality: DataQualityRow[];
  nStudents: number | null;
}
