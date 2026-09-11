import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";
import { PaginationDto } from "../../common/pagination.dto";
import { VenueStatus } from "../venue.repository";

const venueStatuses: VenueStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "HIDDEN",
  "ARCHIVED",
];

export class AdminVenuesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: venueStatuses })
  @IsOptional()
  @IsIn(venueStatuses)
  status?: VenueStatus;
}
