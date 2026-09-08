import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ReadinessService } from "./readiness.service";

@ApiTags("health")
@Controller()
export class HealthController {
  constructor(private readonly readiness: ReadinessService) {}

  @Get("health")
  @ApiOkResponse({ schema: { example: { status: "ok" } } })
  health(): { status: "ok" } {
    return { status: "ok" };
  }

  @Get("ready")
  @ApiOkResponse({ schema: { example: { status: "ready" } } })
  ready(): Promise<{ status: "ready" }> {
    return this.readiness.assertReady();
  }
}
