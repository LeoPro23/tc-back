import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NotificationService } from '../application/notification.service';

@Module({
    imports: [HttpModule],
    providers: [NotificationService],
    exports: [NotificationService],
})
export class NotificationModule { }
