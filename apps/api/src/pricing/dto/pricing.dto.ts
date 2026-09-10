import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsInt, Max, Min } from "class-validator";

export class PricingRuleDto {
  @ApiProperty({ minimum: 1, maximum: 7 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  @ApiProperty({ minimum: 0, maximum: 1410 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1410)
  startMinute!: number;

  @ApiProperty({ minimum: 30, maximum: 1440 })
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(1440)
  endMinute!: number;

  @ApiProperty({ description: "VND for one 30-minute slot" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  pricePerSlot!: number;
}

export class QuoteDto {
  @ApiProperty()
  @IsDateString({ strict: true })
  startAt!: string;

  @ApiProperty()
  @IsDateString({ strict: true })
  endAt!: string;
}
