export type DecimalLike = { toNumber(): number };

export function decimalToNumber(value: DecimalLike): number {
  return value.toNumber();
}

export function dateToIso(value: Date): string {
  return value.toISOString();
}

export function patientName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}
