import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "customer@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 12, example: "StrongPass123!" })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: "0901234567" })
  @IsString()
  phone!: string;

  @ApiProperty({ example: "Nguyễn An" })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName!: string;
}
