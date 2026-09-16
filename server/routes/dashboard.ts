import { Router } from 'express'
import { prisma } from '../prisma.js'
import { auth, requireModule } from '../middleware/auth.js'
import { createDashboardMetricsHandler } from '../services/dashboard.js'

export const router = Router()
router.get('/metrics', auth(), requireModule('dashboard'), createDashboardMetricsHandler(prisma))
