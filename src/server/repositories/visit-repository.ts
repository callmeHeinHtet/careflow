import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { dateToIso, decimalToNumber, patientName } from "../serializers/patient";
import type { VisitQueryInput } from "../validation/visit-mutations";

const visitInclude = {
  patient: { include: { allergies: { orderBy: { substance: "asc" as const } } } },
  department: true,
  triage: true,
  consultation: true,
  labOrders: { orderBy: { createdAt: "asc" as const } },
  prescriptions: { include: { medication: true }, orderBy: { orderedAt: "asc" as const } },
  invoice: { include: { lines: true, payments: true } },
} satisfies Prisma.VisitInclude;

type VisitRecord = Prisma.VisitGetPayload<{ include: typeof visitInclude }>;

function serializeVisit(visit: VisitRecord) {
  return {
    id: visit.id,
    queueToken: visit.queueToken,
    stage: visit.stage,
    priority: visit.priority,
    symptoms: visit.symptoms,
    arrivedAt: dateToIso(visit.arrivedAt),
    dischargedAt: visit.dischargedAt ? dateToIso(visit.dischargedAt) : null,
    version: visit.version,
    patient: {
      id: visit.patient.id,
      medicalRecordNumber: visit.patient.medicalRecordNumber,
      name: patientName(visit.patient.firstName, visit.patient.lastName),
      firstName: visit.patient.firstName,
      lastName: visit.patient.lastName,
      dateOfBirth: dateToIso(visit.patient.dateOfBirth),
      sex: visit.patient.sex,
      phone: visit.patient.phone,
      allergies: visit.patient.allergies.map((allergy) => allergy.substance),
    },
    department: {
      id: visit.department.id,
      code: visit.department.code,
      name: visit.department.name,
    },
    triage: visit.triage
      ? {
          temperature: decimalToNumber(visit.triage.temperature),
          bloodPressure: visit.triage.bloodPressure,
          heartRate: visit.triage.heartRate,
          oxygenSat: visit.triage.oxygenSat,
          notes: visit.triage.notes,
          recordedAt: dateToIso(visit.triage.recordedAt),
        }
      : null,
    consultation: visit.consultation
      ? {
          findings: visit.consultation.findings,
          diagnosis: visit.consultation.diagnosis,
          followUp: visit.consultation.followUp,
          recordedAt: dateToIso(visit.consultation.recordedAt),
        }
      : null,
    labOrders: visit.labOrders.map((order) => ({
      id: order.id,
      name: order.name,
      status: order.status,
    })),
    prescriptions: visit.prescriptions.map((prescription) => ({
      id: prescription.id,
      medicationId: prescription.medicationId,
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
          version: visit.invoice.version,
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

export type VisitDetail = ReturnType<typeof serializeVisit>;

export async function listVisits(
  db: PrismaClient,
  input: VisitQueryInput,
): Promise<{ items: VisitDetail[]; nextCursor: string | null }> {
  const query = input.query?.trim();
  const rows = await db.visit.findMany({
    where: {
      stage: input.stage,
      departmentId: input.departmentId,
      patient: { deletedAt: null },
      ...(query
        ? {
            OR: [
              { queueToken: { contains: query, mode: "insensitive" as const } },
              { patient: { medicalRecordNumber: { contains: query, mode: "insensitive" as const } } },
              { patient: { firstName: { contains: query, mode: "insensitive" as const } } },
              { patient: { lastName: { contains: query, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    include: visitInclude,
    orderBy: [{ arrivedAt: "desc" }, { id: "desc" }],
    cursor: input.cursor ? { id: input.cursor } : undefined,
    skip: input.cursor ? 1 : 0,
    take: input.limit + 1,
  });
  const hasMore = rows.length > input.limit;
  const page = hasMore ? rows.slice(0, input.limit) : rows;
  return {
    items: page.map(serializeVisit),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  };
}

export async function getVisitById(
  db: PrismaClient | Prisma.TransactionClient,
  id: string,
): Promise<VisitDetail | null> {
  const visit = await db.visit.findFirst({
    where: { id, patient: { deletedAt: null } },
    include: visitInclude,
  });
  return visit ? serializeVisit(visit) : null;
}
