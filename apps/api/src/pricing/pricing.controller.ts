import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Principal } from "../auth/auth.types";
import { AccessTokenGuard } from "../common/auth/access-token.guard";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { Roles } from "../common/auth/roles.decorator";
import { RolesGuard } from "../common/auth/roles.guard";
import { PricingRuleDto, QuoteDto } from "./dto/pricing.dto";
import { PricingService } from "./pricing.service";

@ApiTags("pricing")
@Controller()
export class PublicPricingController {
  constructor(private readonly pricing: PricingService) {}

  @Post("offerings/:offeringId/quotes")
  @HttpCode(200)
  quote(@Param("offeringId") offeringId: string, @Body() dto: QuoteDto) {
    return this.pricing.quote(offeringId, {
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
    });
  }
}

@ApiTags("owner-pricing")
@ApiBearerAuth()
@Roles("OWNER")
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller("owner")
export class OwnerPricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get("offerings/:offeringId/pricing-rules")
  list(
    @CurrentUser() owner: Principal,
    @Param("offeringId") offeringId: string,
  ) {
    return this.pricing.listRules(owner.userId, offeringId);
  }

  @Post("offerings/:offeringId/pricing-rules")
  create(
    @CurrentUser() owner: Principal,
    @Param("offeringId") offeringId: string,
    @Body() dto: PricingRuleDto,
  ) {
    return this.pricing.createRule(owner.userId, offeringId, dto);
  }

  @Patch("pricing-rules/:id")
  update(
    @CurrentUser() owner: Principal,
    @Param("id") id: string,
    @Body() dto: PricingRuleDto,
  ) {
    return this.pricing.updateRule(owner.userId, id, dto);
  }

  @Delete("pricing-rules/:id")
  @HttpCode(204)
  delete(@CurrentUser() owner: Principal, @Param("id") id: string) {
    return this.pricing.deleteRule(owner.userId, id);
  }
}
