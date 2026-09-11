import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";
import { PaginationDto } from "../../common/pagination.dto";
import { OwnerApplicationStatus } from "../owner-application.repository";

export class AdminOwnerApplicationsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ["PENDING", "APPROVED", "REJECTED"] })
  @IsOptional()
  @IsIn(["PENDING", "APPROVED", "REJECTED"] satisfies OwnerApplicationStatus[])
  status?: OwnerApplicationStatus;
}
