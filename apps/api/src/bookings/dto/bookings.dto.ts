import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BookingStatus } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import { PaginationDto } from "../../common/pagination.dto";

export class BookingListDto extends PaginationDto {
  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;

  @ApiPropertyOptional({ enum: ["startAtAsc", "startAtDesc"] })
  @IsOptional()
  @IsIn(["startAtAsc", "startAtDesc"])
  sort: "startAtAsc" | "startAtDesc" = "startAtDesc";
}

export class OwnerBookingListDto extends BookingListDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  venueId?: string;
}

export class BookingIntervalDto {
  @ApiProperty()
  @IsDateString({ strict: true })
  startAt!: string;

  @ApiProperty()
  @IsDateString({ strict: true })
  endAt!: string;
}

export class CreateBookingDto extends BookingIntervalDto {
  @ApiProperty()
  @IsUUID()
  offeringId!: string;
}

export class OptionalReasonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RequiredReasonDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class ReassignBookingDto {
  @ApiProperty()
  @IsUUID()
  courtId!: string;
}
