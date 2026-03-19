import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('connectivity')
  async checkConnectivity(): Promise<{
    online: boolean;
    services: Record<string, boolean>;
  }> {
    const checks = await Promise.allSettled([
      fetch('https://openrouter.ai/api/v1/models', {
        method: 'HEAD',
        signal: AbortSignal.timeout(4000),
      }),
      fetch(
        (process.env.MINIO_ENDPOINT || 'https://localhost') + '/minio/health/live',
        { method: 'HEAD', signal: AbortSignal.timeout(4000) },
      ),
    ]);

    const ai = checks[0].status === 'fulfilled' && checks[0].value.ok;
    const storage = checks[1].status === 'fulfilled';

    return {
      online: ai || storage,
      services: { ai, storage, database: true, mlModel: true },
    };
  }
}
