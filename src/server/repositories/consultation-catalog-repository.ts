import type { PrismaClient } from "../../generated/prisma/client";
import { decimalToNumber } from "../serializers/patient";

export async function getConsultationCatalog(db: PrismaClient) {
  const [services, medications] = await Promise.all([
    db.clinicalService.findMany({
      where: { active: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    db.medication.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const serializeService = (service: (typeof services)[number]) => ({
    id: service.id,
    code: service.code,
    name: service.name,
    unitPrice: decimalToNumber(service.unitPrice),
    departmentId: service.departmentId,
  });
  return {
    consultationServices: services
      .filter((service) => service.type === "CONSULTATION")
      .map(serializeService),
    labServices: services.filter((service) => service.type === "LAB").map(serializeService),
    medications: medications.map((medication) => ({
      id: medication.id,
      code: medication.code,
      name: medication.name,
      form: medication.form,
      strength: medication.strength,
      unitPrice: decimalToNumber(medication.unitPrice),
    })),
  };
}
