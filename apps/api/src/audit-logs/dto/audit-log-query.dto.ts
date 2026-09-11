import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { PaginationDto } from "../../common/pagination.dto";

export class AuditLogQueryDto extends PaginationDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  resourceType?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @ApiPropertyOptional({ enum: ["newest", "oldest"], default: "newest" })
  @IsOptional()
  @IsIn(["newest", "oldest"])
  sort: "newest" | "oldest" = "newest";
}
