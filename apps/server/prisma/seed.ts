import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@chatapp.dev" },
    update: {},
    create: {
      email: "demo@chatapp.dev",
      name: "Demo User",
      passwordHash
    }
  });

  const alexUser = await prisma.user.upsert({
    where: { email: "alex@chatapp.dev" },
    update: {},
    create: {
      email: "alex@chatapp.dev",
      name: "Alex Chen",
      passwordHash
    }
  });

  const room = await prisma.room.create({
    data: {
      name: "General",
      description: "Start here for team-wide conversation.",
      createdById: demoUser.id,
      members: {
        create: [{ userId: demoUser.id }, { userId: alexUser.id }]
      }
    }
  });

  const welcomeMessage = await prisma.message.create({
    data: {
      roomId: room.id,
      authorId: demoUser.id,
      content: "Welcome to the real-time chat app."
    }
  });

  await prisma.messageRead.create({
    data: {
      messageId: welcomeMessage.id,
      userId: alexUser.id
    }
  });

  const directKey = [alexUser.id, demoUser.id].sort().join(":");

  await prisma.room.upsert({
    where: { directKey },
    update: {},
    create: {
      name: "Direct message",
      createdById: demoUser.id,
      kind: "DIRECT",
      directKey,
      members: {
        create: [{ userId: demoUser.id }, { userId: alexUser.id }]
      },
      messages: {
        create: {
          authorId: alexUser.id,
          content: "Hey, want to test the direct message flow?"
        }
      }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
