import { Controller, UseGuards } from '@nestjs/common'
import { ExtractProjectIdMiddleware } from '../../../middlewares/extract-project-id/extract-project-id.middleware'
import { AuthGuard } from '@nestjs/passport'

@Controller()
@UseGuards(ExtractProjectIdMiddleware, AuthGuard('jwt'))
export class OldDatasController {}
