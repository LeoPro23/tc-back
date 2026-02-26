import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PestModule } from './pests/infrastructure/pest.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/infrastructure/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule, PestModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
