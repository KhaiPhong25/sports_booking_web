import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationPublisher } from "./notification-publisher";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationPublisher, NotificationsService],
  exports: [NotificationPublisher],
})
export class NotificationsModule {}
