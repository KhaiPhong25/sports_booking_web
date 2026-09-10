import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class RejectOwnerApplicationDto {
  @ApiProperty({ example: "Thiếu giấy tờ chứng minh quyền vận hành" })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;
}
