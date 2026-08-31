import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { dateToIso, decimalToNumber, patientName } from "../serializers/patient";

const patientInclude = {
  allergies: { orderBy: { substance: "asc" as const } },
  visits: {
    orderBy: { arrivedAt: "desc" as const },
    include: {
      department: true,
      triage: true,
      consultation: true,
      labOrders: true,
      prescriptions: { include: { medication: true } },
      invoice: { include: { lines: true, payments: true } },
    },
  },
} satisfies Prisma.PatientInclude;

type PatientRecord = Prisma.PatientGetPayload<{ include: typeof patientInclude }>;

function serializeVisit(visit: PatientRecord["visits"][number]) {
  return {
    id: visit.id,
    queueToken: visit.queueToken,
    stage: visit.stage,
    priority: visit.priority,
    symptoms: visit.symptoms,
    arrivedAt: dateToIso(visit.arrivedAt),
    dischargedAt: visit.dischargedAt ? dateToIso(visit.dischargedAt) : null,
    version: visit.version,
    department: { id: visit.department.id, code: visit.department.code, name: visit.department.name },
    triage: visit.triage
      ? {
          temperature: decimalToNumber(visit.triage.temperature),
          bloodPressure: visit.triage.bloodPressure,
          heartRate: visit.triage.heartRate,
          oxygenSat: visit.triage.oxygenSat,
          notes: visit.triage.notes,
        }
      : null,
    consultation: visit.consultation
      ? {
          findings: visit.consultation.findings,
          diagnosis: visit.consultation.diagnosis,
          followUp: visit.consultation.followUp,
        }
      : null,
    labOrders: visit.labOrders.map((order) => ({ id: order.id, name: order.name, status: order.status })),
    prescriptions: visit.prescriptions.map((prescription) => ({
      id: prescription.id,
      medicine: prescription.medication.name,
      strength: prescription.medication.strength,
      quantity: prescription.quantity,
      directions: prescription.directions,
      status: prescription.status,
    })),
    invoice: visit.invoice
      ? {
          id: visit.invoice.id,
          status: visit.invoice.status,
          currency: visit.invoice.currency,
          subtotal: decimalToNumber(visit.invoice.subtotal),
          total: decimalToNumber(visit.invoice.total),
          lines: visit.invoice.lines.map((line) => ({
            id: line.id,
            type: line.type,
            description: line.description,
            quantity: line.quantity,
            unitPrice: decimalToNumber(line.unitPrice),
            total: decimalToNumber(line.total),
          })),
          payments: visit.invoice.payments.map((payment) => ({
            id: payment.id,
            amount: decimalToNumber(payment.amount),
            method: payment.method,
            status: payment.status,
            paidAt: payment.paidAt ? dateToIso(payment.paidAt) : null,
          })),
        }
      : null,
  };
}

function serializePatient(patient: PatientRecord) {
  return {
    id: patient.id,
    medicalRecordNumber: patient.medicalRecordNumber,
    name: patientName(patient.firstName, patient.lastName),
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: dateToIso(patient.dateOfBirth),
    sex: patient.sex,
    phone: patient.phone,
    address: patient.address,
    version: patient.version,
    allergies: patient.allergies.map((allergy) => allergy.substance),
    visits: patient.visits.map(serializeVisit),
  };
}

export type PatientDetail = ReturnType<typeof serializePatient>;
export type PatientSummary = Omit<PatientDetail, "visits"> & {
  latestVisit: PatientDetail["visits"][number] | null;
};
export type PatientPage = { items: PatientSummary[]; nextCursor: string | null };

export async function listPatients(
  db: PrismaClient,
  input: { query?: string; cursor?: string; limit: number },
): Promise<PatientPage> {
  const limit = Math.min(25, Math.max(1, Math.trunc(input.limit)));
  const query = input.query?.trim();
  const search: Prisma.PatientWhereInput | undefined = query
    ? {
        OR: [
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { medicalRecordNumber: { contains: query, mode: "insensitive" } },
          { phone: { contains: query } },
          { visits: { some: { queueToken: { contains: query, mode: "insensitive" } } } },
          { visits: { some: { department: { name: { contains: query, mode: "insensitive" } } } } },
        ],
      }
    : undefined;

  const rows = await db.patient.findMany({
    where: { deletedAt: null, AND: search },
    include: patientInclude,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
    cursor: input.cursor ? { id: input.cursor } : undefined,
    skip: input.cursor ? 1 : 0,
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: pageRows.map((row) => {
      const patient = serializePatient(row);
      const { visits, ...summary } = patient;
      return { ...summary, latestVisit: visits[0] ?? null };
    }),
    nextCursor: hasMore ? pageRows.at(-1)?.id ?? null : null,
  };
}

export async function getPatientById(
  db: PrismaClient | Prisma.TransactionClient,
  id: string,
): Promise<PatientDetail | null> {
  const patient = await db.patient.findFirst({
    where: { id, deletedAt: null },
    include: patientInclude,
  });
  return patient ? serializePatient(patient) : null;
}
