import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { Principal } from "../auth/auth.types";
import { AccessTokenGuard } from "../common/auth/access-token.guard";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { OBJECT_STORAGE, ObjectStorage } from "../storage/object-storage";
import {
  MAX_USER_AVATAR_BYTES,
  createUserAvatarKey,
  validateUserAvatar,
} from "../storage/user-avatar-policy";
import { UsersService } from "./users.service";

interface UploadedAvatar {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@ApiTags("user-profile")
@Controller()
export class UserAvatarsController {
  constructor(
    private readonly users: UsersService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  @ApiBearerAuth()
  @ApiConsumes("multipart/form-data")
  @UseGuards(AccessTokenGuard)
  @UseInterceptors(
    FileInterceptor("avatar", {
      limits: { fileSize: MAX_USER_AVATAR_BYTES },
    }),
  )
  @Post("me/avatar")
  async upload(
    @CurrentUser() user: Principal,
    @UploadedFile() file?: UploadedAvatar,
  ) {
    if (!file) throw new BadRequestException("Avatar image is required");
    validateUserAvatar(file.mimetype, file.size, file.buffer);
    const objectKey = createUserAvatarKey(user.userId);
    await this.storage.putObject(objectKey, file.buffer, file.mimetype);
    return this.users.setAvatar(user.userId, objectKey);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @HttpCode(204)
  @Delete("me/avatar")
  async remove(@CurrentUser() user: Principal): Promise<void> {
    const avatar = await this.users.avatarObject(user.userId);
    if (!avatar) return;
    await this.storage.deleteObject(avatar.objectKey);
    await this.users.setAvatar(user.userId, null);
  }

  @Get("users/:id/avatar")
  async image(@Param("id") userId: string, @Res() response: Response) {
    const avatar = await this.users.avatarObject(userId);
    if (!avatar) throw new NotFoundException("Avatar not found");
    const object = await this.storage.getObject(avatar.objectKey);
    response.set({
      "Cache-Control": "public, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    });
    response.type(object.contentType).send(object.data);
  }
}
