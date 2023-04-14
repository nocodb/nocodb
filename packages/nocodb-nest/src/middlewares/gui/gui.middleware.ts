import { Injectable, NestMiddleware } from '@nestjs/common'
import NcToolGui from 'nc-lib-gui'

@Injectable()
export class GuiMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const dashboardPath = process.env.NC_DASHBOARD_URL || '/dashboard'
    NcToolGui.expressMiddleware(dashboardPath)(req, res, next)
  }
}
