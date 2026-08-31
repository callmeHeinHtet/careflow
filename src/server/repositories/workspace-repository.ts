import type { PrismaClient, StaffRole } from "../../generated/prisma/client";
import type { DemoState, Priority, Role, Stage } from "../../lib/types";
import { decimalToNumber } from "../serializers/patient";
import { listAuditEvents } from "./audit-repository";
import { listVisits } from "./visit-repository";

const roleLabel: Record<StaffRole, Role> = {
  RECEPTION: "Reception",
  NURSE: "Nurse",
  DOCTOR: "Doctor",
  PHARMACY: "Pharmacy",
  CASHIER: "Cashier",
  ADMIN: "Admin",
};

function ageAt(dateOfBirth: string, now = new Date()): number {
  const birth = new Date(dateOfBirth);
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export async function getWorkspaceSnapshot(
  db: PrismaClient,
  actor: { actorUserId: string; role: StaffRole },
): Promise<DemoState> {
  const [visits, medications, labServices, audit] = await Promise.all([
    listVisits(db, { limit: 25 }),
    db.medication.findMany({
      where: { active: true },
      include: { lots: { orderBy: { expiresAt: "asc" } } },
      orderBy: { name: "asc" },
    }),
    db.clinicalService.findMany({ where: { active: true, type: "LAB" }, orderBy: { name: "asc" } }),
    listAuditEvents(db, { ...actor, limit: 50 }),
  ]);

  return {
    patients: visits.items.map((visit) => {
      const lines = visit.invoice?.lines ?? [];
      const lineTotal = (type: "CONSULTATION" | "LAB" | "MEDICATION") =>
        lines.filter((line) => line.type === type).reduce((sum, line) => sum + line.total, 0);
      return {
        id: visit.patient.id,
        visitId: visit.id,
        visitVersion: visit.version,
        invoiceVersion: visit.invoice?.version,
        queueNumber: visit.queueToken,
        name: visit.patient.name,
        age: ageAt(visit.patient.dateOfBirth),
        sex: visit.patient.sex,
        phone: visit.patient.phone,
        address: visit.patient.address,
        allergies: visit.patient.allergies,
        department: visit.department.name,
        stage: visit.stage.toLowerCase() as Stage,
        priority: visit.priority.toLowerCase() as Priority,
        arrival: visit.arrivedAt.slice(11, 16),
        symptoms: visit.symptoms,
        vitals: visit.triage
          ? {
              temperature: String(visit.triage.temperature),
              bloodPressure: visit.triage.bloodPressure,
              heartRate: String(visit.triage.heartRate),
              spo2: String(visit.triage.oxygenSat),
            }
          : undefined,
        triageNotes: visit.triage?.notes,
        findings: visit.consultation?.findings,
        diagnosis: visit.consultation?.diagnosis,
        followUp: visit.consultation?.followUp ?? undefined,
        prescriptions: visit.prescriptions.map((prescription) => ({
          id: prescription.id,
          medicineId: prescription.medicationId,
          quantity: prescription.quantity,
          directions: prescription.directions,
          status: prescription.status.toLowerCase() as "ordered" | "dispensed",
        })),
        labs: visit.labOrders.map((order) => order.name),
        billing: {
          consultation: lineTotal("CONSULTATION"),
          labs: lineTotal("LAB"),
          medication: lineTotal("MEDICATION"),
          status: visit.invoice?.status === "PAID" ? "paid" : "unpaid",
        },
      };
    }),
    inventory: medications.map((medication) => ({
      id: medication.id,
      name: `${medication.name} ${medication.strength}`,
      form: medication.form,
      stock: medication.lots.reduce((sum, lot) => sum + lot.quantityOnHand, 0),
      reorderAt: medication.reorderAt,
      expiry: medication.lots[0]?.expiresAt.toISOString().slice(0, 10) ?? "—",
      unitPrice: decimalToNumber(medication.unitPrice),
    })),
    labServices: labServices.map((service) => ({ id: service.id, name: service.name })),
    audit: audit.items.map((event) => ({
      id: event.id,
      actor: event.actorName,
      role: roleLabel[event.role as StaffRole] ?? "Admin",
      action: event.action,
      patientId: event.entityType === "Patient" || event.entityType === "Visit" ? event.entityId : null,
      timestamp: event.createdAt,
      details: `${event.entityType} · ${event.entityId}`,
    })),
  };
}
