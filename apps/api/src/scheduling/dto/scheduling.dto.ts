import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class OperatingWindowDto {
  @ApiProperty({ minimum: 1, maximum: 7 })
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  @ApiProperty({ minimum: 0, maximum: 1410 })
  @IsInt()
  @Min(0)
  @Max(1410)
  startMinute!: number;

  @ApiProperty({ minimum: 30, maximum: 1440 })
  @IsInt()
  @Min(30)
  @Max(1440)
  endMinute!: number;
}

export class ReplaceOperatingHoursDto {
  @ApiProperty({ type: [OperatingWindowDto] })
  @IsArray()
  @ArrayMaxSize(28)
  @ValidateNested({ each: true })
  @Type(() => OperatingWindowDto)
  windows!: OperatingWindowDto[];
}

export class ClosureDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courtId?: string;

  @ApiProperty()
  @IsDateString({ strict: true })
  startAt!: string;

  @ApiProperty()
  @IsDateString({ strict: true })
  endAt!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
