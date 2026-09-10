import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateOwnerApplicationDto {
  @ApiProperty({ example: "Sân Xanh Sài Gòn" })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  businessName!: string;

  @ApiPropertyOptional({ example: "Ba năm quản lý sân thể thao" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  experience?: string;
}
