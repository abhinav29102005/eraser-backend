const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // Create test users
    const password = await bcrypt.hash('password123', 12);

    const user1 = await prisma.user.upsert({
      where: { email: 'alice@example.com' },
      update: {},
      create: {
        email: 'alice@example.com',
        hashedPassword: password,
        name: 'Alice Johnson',
      },
    });

    const user2 = await prisma.user.upsert({
      where: { email: 'bob@example.com' },
      update: {},
      create: {
        email: 'bob@example.com',
        hashedPassword: password,
        name: 'Bob Smith',
      },
    });

    console.log('✅ Users created');

    // Create test boards
    const board1 = await prisma.board.create({
      data: {
        title: 'Project Planning Board',
        userId: user1.id,
        documentState: [
          {
            id: 'rect_1',
            type: 'rectangle',
            x: 100,
            y: 100,
            width: 200,
            height: 150,
            fill: '#3B82F6',
            userId: user1.id,
            userName: user1.name,
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });

    const board2 = await prisma.board.create({
      data: {
        title: 'Design Mockups',
        userId: user2.id,
        isPublic: true,
        documentState: [],
      },
    });

    console.log('✅ Boards created');

    // Add collaborator
    await prisma.boardCollaborator.create({
      data: {
        boardId: board1.id,
        userId: user2.id,
        permission: 'edit',
      },
    });

    console.log('✅ Collaborators added');

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📧 Test users:');
    console.log(`   - ${user1.email} / password123`);
    console.log(`   - ${user2.email} / password123`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
