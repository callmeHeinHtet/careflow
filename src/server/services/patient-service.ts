import type { Prisma, PrismaClient, StaffRole } from "../../generated/prisma/client";
import { writeAuditEvent } from "../audit/write-audit-event";
import { AppError } from "../http/app-error";
import { runIdempotentMutation } from "../http/idempotency";
import { getPatientById } from "../repositories/patient-repository";
import type {
  PatientRegistrationInput,
  PatientUpdateInput,
} from "../validation/patient-mutations";

type MutationActor = {
  userId: string;
  displayName: string;
  role: StaffRole;
  correlationId: string;
  ipAddress: string | null;
};

async function nextIdentifier(tx: Prisma.TransactionClient, sequence: string): Promise<number> {
  const allowed = new Set(["careflow_mrn_seq", "careflow_queue_token_seq"]);
  if (!allowed.has(sequence)) throw new Error("Unsupported identifier sequence");
  const rows = await tx.$queryRawUnsafe<Array<{ value: string }>>(
    `SELECT nextval('${sequence}')::text AS value`,
  );
  return Number(rows[0].value);
}

export function registerPatient(
  db: PrismaClient,
  input: PatientRegistrationInput,
  actor: MutationActor,
  idempotencyKey: string,
) {
  return runIdempotentMutation(db, {
    actorUserId: actor.userId,
    scope: "patients.register",
    key: idempotencyKey,
    payload: input,
    execute: async (tx) => {
      const department = await tx.department.findFirst({
        where: { id: input.departmentId, active: true },
      });
      if (!department) {
        throw new AppError("VALIDATION_FAILED", "The selected department is unavailable", 400);
      }

      const [mrnNumber, queueNumber] = await Promise.all([
        nextIdentifier(tx, "careflow_mrn_seq"),
        nextIdentifier(tx, "careflow_queue_token_seq"),
      ]);
      const patient = await tx.patient.create({
        data: {
          medicalRecordNumber: `MRN-${String(mrnNumber).padStart(6, "0")}`,
          firstName: input.firstName,
          lastName: input.lastName,
          dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00.000Z`),
          sex: input.sex,
          phone: input.phone,
          address: input.address,
          allergies: {
            create: input.allergies.map((allergy) => ({
              substance: allergy.substance,
              notes: allergy.notes,
            })),
          },
          visits: {
            create: {
              queueToken: `OPD-${String(queueNumber).padStart(3, "0")}`,
              departmentId: department.id,
              stage: "WAITING",
              priority: input.priority,
              symptoms: input.symptoms,
              arrivedAt: new Date(),
            },
          },
        },
        include: { visits: { orderBy: { arrivedAt: "desc" }, take: 1 } },
      });
      const visit = patient.visits[0];

      await writeAuditEvent(tx, {
        actorUserId: actor.userId,
        actorName: actor.displayName,
        role: actor.role,
        action: "PATIENT_REGISTERED",
        entityType: "Patient",
        entityId: patient.id,
        after: {
          medicalRecordNumber: patient.medicalRecordNumber,
          visitId: visit.id,
          queueToken: visit.queueToken,
          departmentId: department.id,
        },
        correlationId: actor.correlationId,
        ipAddress: actor.ipAddress,
      });

      return {
        status: 201,
        body: {
          data: {
            patient: {
              id: patient.id,
              medicalRecordNumber: patient.medicalRecordNumber,
              firstName: patient.firstName,
              lastName: patient.lastName,
              version: patient.version,
            },
            visit: {
              id: visit.id,
              queueToken: visit.queueToken,
              stage: visit.stage,
              priority: visit.priority,
              version: visit.version,
              department: { id: department.id, code: department.code, name: department.name },
            },
          },
        },
      };
    },
  });
}

export function updatePatientDemographics(
  db: PrismaClient,
  patientId: string,
  input: PatientUpdateInput,
  actor: MutationActor,
  idempotencyKey: string,
) {
  return runIdempotentMutation(db, {
    actorUserId: actor.userId,
    scope: `patients.${patientId}.demographics`,
    key: idempotencyKey,
    payload: input,
    execute: async (tx) => {
      const current = await tx.patient.findFirst({
        where: { id: patientId, deletedAt: null },
        include: { allergies: { orderBy: { substance: "asc" } } },
      });
      if (!current) throw new AppError("NOT_FOUND", "Patient not found", 404);
      if (current.version !== input.version) {
        throw new AppError("CONFLICT", "The patient record changed", 409, {
          currentVersion: current.version,
        });
      }

      const { version, allergies, ...changes } = input;
      const updated = await tx.patient.updateMany({
        where: { id: patientId, version, deletedAt: null },
        data: {
          ...changes,
          ...(changes.dateOfBirth
            ? { dateOfBirth: new Date(`${changes.dateOfBirth}T00:00:00.000Z`) }
            : {}),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        const latest = await tx.patient.findUnique({ where: { id: patientId } });
        throw new AppError("CONFLICT", "The patient record changed", 409, {
          currentVersion: latest?.version,
        });
      }

      if (allergies) {
        await tx.patientAllergy.deleteMany({ where: { patientId } });
        if (allergies.length) {
          await tx.patientAllergy.createMany({
            data: allergies.map((allergy) => ({
              patientId,
              substance: allergy.substance,
              notes: allergy.notes,
            })),
          });
        }
      }

      const patient = await getPatientById(tx, patientId);
      if (!patient) throw new AppError("NOT_FOUND", "Patient not found", 404);
      await writeAuditEvent(tx, {
        actorUserId: actor.userId,
        actorName: actor.displayName,
        role: actor.role,
        action: "PATIENT_DEMOGRAPHICS_UPDATED",
        entityType: "Patient",
        entityId: patientId,
        before: {
          version: current.version,
          firstName: current.firstName,
          lastName: current.lastName,
          dateOfBirth: current.dateOfBirth.toISOString().slice(0, 10),
          sex: current.sex,
          phone: current.phone,
          address: current.address,
          allergies: current.allergies.map((allergy) => allergy.substance),
        },
        after: {
          version: patient.version,
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dateOfBirth.slice(0, 10),
          sex: patient.sex,
          phone: patient.phone,
          address: patient.address,
          allergies: patient.allergies,
        },
        correlationId: actor.correlationId,
        ipAddress: actor.ipAddress,
      });

      return { status: 200, body: { data: { patient } } };
    },
  });
}
