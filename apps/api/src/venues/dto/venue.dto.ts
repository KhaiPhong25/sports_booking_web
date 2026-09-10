import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { PaginationDto } from "../../common/pagination.dto";

export class VenueSearchDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() sportId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() areaId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  startAt?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  endAt?: string;
}

export class CreateVenueDto {
  @ApiProperty() @IsUUID() areaId!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(300) address!: string;
  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  description!: string;
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}

export class UpdateVenueDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() areaId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  address?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  description?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}

export class SetAmenitiesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(30)
  @IsUUID(undefined, { each: true })
  amenityIds!: string[];
}

export class CreateOfferingDto {
  @ApiProperty() @IsUUID() sportId!: string;
  @ApiProperty({ enum: ["INSTANT", "OWNER_APPROVAL"] })
  @IsEnum({ INSTANT: "INSTANT", OWNER_APPROVAL: "OWNER_APPROVAL" })
  confirmationMode!: "INSTANT" | "OWNER_APPROVAL";
  @ApiProperty() @IsInt() @Min(1) @Max(365) advanceBookingDays!: number;
  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(10080)
  cancellationNoticeMinutes!: number;
}

export class UpdateOfferingDto {
  @ApiPropertyOptional({ enum: ["INSTANT", "OWNER_APPROVAL"] })
  @IsOptional()
  @IsEnum({ INSTANT: "INSTANT", OWNER_APPROVAL: "OWNER_APPROVAL" })
  confirmationMode?: "INSTANT" | "OWNER_APPROVAL";
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  advanceBookingDays?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10080)
  cancellationNoticeMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CourtDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  internalName!: string;
}

export class CourtActiveDto {
  @ApiProperty() @IsBoolean() isActive!: boolean;
}

export class ModerationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason?: string;
}
