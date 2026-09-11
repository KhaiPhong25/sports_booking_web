import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { RoleName } from "../../auth/auth.types";
import { PaginationDto } from "../../common/pagination.dto";

export class AdminUsersQueryDto extends PaginationDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;

  @ApiPropertyOptional({ enum: ["CUSTOMER", "OWNER", "ADMIN"] })
  @IsOptional()
  @IsIn(["CUSTOMER", "OWNER", "ADMIN"] satisfies RoleName[])
  role?: RoleName;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  @IsBoolean()
  locked?: boolean;
}
