import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PestModule } from './pests/infrastructure/pest.module';

@Module({
  imports: [PestModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
