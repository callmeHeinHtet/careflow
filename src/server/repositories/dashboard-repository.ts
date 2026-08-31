import { VisitStage, type PrismaClient } from "../../generated/prisma/client";

export type DashboardSnapshot = {
  metrics: {
    totalPatients: number;
    waitingNow: number;
    completedVisits: number;
    averageWaitMinutes: number;
    lowStockMedications: number;
  };
  departments: Array<{
    id: string;
    code: string;
    name: string;
    capacity: number;
    activeVisits: number;
  }>;
};

export async function getDashboardSnapshot(
  db: PrismaClient,
  now: Date,
): Promise<DashboardSnapshot> {
  const [totalPatients, waitingVisits, completedVisits, medications, departments] =
    await Promise.all([
      db.patient.count({ where: { deletedAt: null } }),
      db.visit.findMany({
        where: { stage: { in: [VisitStage.WAITING, VisitStage.TRIAGE] } },
        select: { arrivedAt: true },
      }),
      db.visit.count({ where: { stage: VisitStage.DISCHARGED } }),
      db.medication.findMany({
        where: { active: true },
        select: { reorderAt: true, lots: { select: { quantityOnHand: true } } },
      }),
      db.department.findMany({
        where: { active: true },
        orderBy: { displayOrder: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          capacity: true,
          _count: {
            select: { visits: { where: { stage: { not: VisitStage.DISCHARGED } } } },
          },
        },
      }),
    ]);

  const totalWaitMinutes = waitingVisits.reduce(
    (sum, visit) => sum + Math.max(0, (now.getTime() - visit.arrivedAt.getTime()) / 60_000),
    0,
  );
  const lowStockMedications = medications.filter((medication) => {
    const stock = medication.lots.reduce((sum, lot) => sum + lot.quantityOnHand, 0);
    return stock <= medication.reorderAt;
  }).length;

  return {
    metrics: {
      totalPatients,
      waitingNow: waitingVisits.length,
      completedVisits,
      averageWaitMinutes: waitingVisits.length
        ? Math.round(totalWaitMinutes / waitingVisits.length)
        : 0,
      lowStockMedications,
    },
    departments: departments.map((department) => ({
      id: department.id,
      code: department.code,
      name: department.name,
      capacity: department.capacity,
      activeVisits: department._count.visits,
    })),
  };
}
