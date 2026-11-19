import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
try {
  if (process.argv.includes('--apply')) {
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
      await tx.$executeRawUnsafe('ALTER TABLE public.leads ALTER COLUMN phone DROP NOT NULL');
    });
  }
  const columns = await db.$queryRaw<Array<{ is_nullable: string }>>`SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'phone'`;
  console.log({ telefoneOpcional: columns[0]?.is_nullable === 'YES', modo: process.argv.includes('--apply') ? 'aplicado' : 'somente-leitura' });
} catch (error) {
  console.error('Não foi possível alterar a obrigatoriedade do telefone.', error instanceof Error ? error.message : 'Erro');
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
