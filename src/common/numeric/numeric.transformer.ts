import { ValueTransformer } from 'typeorm';

export const numericTransformer: ValueTransformer = {
  to: (value?: number | null) => (value == null ? value : value.toFixed(2)),
  from: (value?: string | null) => (value == null ? value : Number(value)),
};
