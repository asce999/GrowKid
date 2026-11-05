import { PrismaClient } from '@prisma/client'

export const db = new PrismaClient()

/** Section 7, Races: takes the child's row lock so score-then-write handlers (approve, request, quest) cannot interleave. Call first inside db.$transaction. */
export const lockChild = (tx, id) => tx.$queryRaw`SELECT 1 FROM "User" WHERE id = ${id} FOR UPDATE`
