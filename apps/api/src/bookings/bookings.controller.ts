import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Principal } from "../auth/auth.types";
import { AccessTokenGuard } from "../common/auth/access-token.guard";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { Roles } from "../common/auth/roles.decorator";
import { RolesGuard } from "../common/auth/roles.guard";
import { BookingsService } from "./bookings.service";
import {
  BookingIntervalDto,
  BookingListDto,
  CreateBookingDto,
  OptionalReasonDto,
  OwnerBookingListDto,
  ReassignBookingDto,
  RequiredReasonDto,
} from "./dto/bookings.dto";

@ApiTags("availability")
@Controller("offerings")
export class AvailabilityController {
  constructor(private readonly bookings: BookingsService) {}

  @Get(":offeringId/availability")
  availability(
    @Param("offeringId") offeringId: string,
    @Query() dto: BookingIntervalDto,
  ) {
    return this.bookings.availability(
      offeringId,
      new Date(dto.startAt),
      new Date(dto.endAt),
    );
  }
}

@ApiTags("bookings")
@ApiBearerAuth()
@Roles("CUSTOMER")
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller("bookings")
export class CustomerBookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  create(
    @CurrentUser() customer: Principal,
    @Headers("idempotency-key") idempotencyKey: string,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookings.create(customer.userId, idempotencyKey, {
      offeringId: dto.offeringId,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
    });
  }

  @Get()
  list(@CurrentUser() customer: Principal, @Query() query: BookingListDto) {
    return this.bookings.customerList(customer.userId, query);
  }

  @Get(":id")
  detail(@CurrentUser() customer: Principal, @Param("id") id: string) {
    return this.bookings.customerDetail(customer.userId, id);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  cancel(
    @CurrentUser() customer: Principal,
    @Param("id") id: string,
    @Body() dto: OptionalReasonDto,
  ) {
    return this.bookings.cancelCustomer(
      customer.userId,
      id,
      dto.reason?.trim() ?? null,
    );
  }
}

@ApiTags("owner-bookings")
@ApiBearerAuth()
@Roles("OWNER")
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller("owner/bookings")
export class OwnerBookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  list(@CurrentUser() owner: Principal, @Query() query: OwnerBookingListDto) {
    return this.bookings.ownerList(owner.userId, query);
  }

  @Get(":id")
  detail(@CurrentUser() owner: Principal, @Param("id") id: string) {
    return this.bookings.ownerDetail(owner.userId, id);
  }

  @Post(":id/confirm")
  @HttpCode(200)
  confirm(@CurrentUser() owner: Principal, @Param("id") id: string) {
    return this.bookings.confirmOwner(owner.userId, owner.userId, id);
  }

  @Post(":id/reject")
  @HttpCode(200)
  reject(
    @CurrentUser() owner: Principal,
    @Param("id") id: string,
    @Body() dto: RequiredReasonDto,
  ) {
    return this.bookings.rejectOwner(
      owner.userId,
      owner.userId,
      id,
      dto.reason,
    );
  }

  @Post(":id/cancel")
  @HttpCode(200)
  cancel(
    @CurrentUser() owner: Principal,
    @Param("id") id: string,
    @Body() dto: RequiredReasonDto,
  ) {
    return this.bookings.cancelOwner(
      owner.userId,
      owner.userId,
      id,
      dto.reason,
    );
  }

  @Post(":id/reassign")
  @HttpCode(200)
  reassign(
    @CurrentUser() owner: Principal,
    @Param("id") id: string,
    @Body() dto: ReassignBookingDto,
  ) {
    return this.bookings.reassignOwner(owner.userId, id, dto.courtId);
  }
}
