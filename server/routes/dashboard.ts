import { Router } from 'express'
import { prisma } from '../prisma.js'
import { auth, requireModule } from '../middleware/auth.js'
import { createDashboardDetailsHandler } from '../services/dashboard-details.js'
import { createDashboardMetricsHandler } from '../services/dashboard.js'

export const router = Router()
router.get('/metrics', auth(), requireModule('dashboard'), createDashboardMetricsHandler(prisma))
router.get('/details', auth(), requireModule('dashboard'), createDashboardDetailsHandler(prisma))
