import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();
async function main() {
  const username = process.env.ADMIN_USERNAME || "admin";
  await db.admin.upsert({
    where: { username },
    update: {},
    create: {
      username,
      passwordHash: await bcrypt.hash(
        process.env.ADMIN_PASSWORD || "admin123",
        12,
      ),
    },
  });
  for (const [index, name] of ["СОП", "НПА", "Приказы"].entries()) {
    const id = `00000000-0000-4000-8000-00000000000${index}`;
    await db.category.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name,
        orderIndex: index,
        children: {
          create: [
            { name: "Общие положения" },
            { name: "Рабочие документы", orderIndex: 1 },
          ],
        },
      },
    });
  }
}
main()
  .finally(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
