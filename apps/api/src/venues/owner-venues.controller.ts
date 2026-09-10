import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { Principal } from "../auth/auth.types";
import { AccessTokenGuard } from "../common/auth/access-token.guard";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { Roles } from "../common/auth/roles.decorator";
import { RolesGuard } from "../common/auth/roles.guard";
import { OBJECT_STORAGE, ObjectStorage } from "../storage/object-storage";
import {
  createVenueImageKey,
  validateVenueImage,
} from "../storage/venue-image-policy";
import {
  CourtActiveDto,
  CourtDto,
  CreateOfferingDto,
  CreateVenueDto,
  SetAmenitiesDto,
  UpdateOfferingDto,
  UpdateVenueDto,
} from "./dto/venue.dto";
import { VenuesService } from "./venues.service";
import { PaginationDto } from "../common/pagination.dto";
import { randomUUID } from "node:crypto";

interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@ApiTags("owner-venues")
@ApiBearerAuth()
@Roles("OWNER")
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller("owner")
export class OwnerVenuesController {
  constructor(
    private readonly venues: VenuesService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  @Get("venues")
  list(@CurrentUser() owner: Principal, @Query() query: PaginationDto) {
    return this.venues.ownerList(owner.userId, query.page, query.pageSize);
  }

  @Post("venues")
  create(@CurrentUser() owner: Principal, @Body() dto: CreateVenueDto) {
    return this.venues.create(owner.userId, dto);
  }

  @Get("venues/:id")
  detail(@CurrentUser() owner: Principal, @Param("id") id: string) {
    return this.venues.ownerDetail(owner.userId, id);
  }

  @Patch("venues/:id")
  update(
    @CurrentUser() owner: Principal,
    @Param("id") id: string,
    @Body() dto: UpdateVenueDto,
  ) {
    return this.venues.update(owner.userId, id, dto);
  }

  @Delete("venues/:id")
  archive(@CurrentUser() owner: Principal, @Param("id") id: string) {
    return this.venues.archive(owner.userId, id);
  }

  @Put("venues/:id/amenities")
  amenities(
    @CurrentUser() owner: Principal,
    @Param("id") id: string,
    @Body() dto: SetAmenitiesDto,
  ) {
    return this.venues.setAmenities(owner.userId, id, dto.amenityIds);
  }

  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("image", { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @Post("venues/:id/images")
  async image(
    @CurrentUser() owner: Principal,
    @Param("id") id: string,
    @UploadedFile() file: UploadedImage,
    @Body("altText") altText: string,
  ) {
    if (!file) throw new BadRequestException("Venue image is required");
    if (!altText || altText.trim().length < 2 || altText.trim().length > 300) {
      throw new BadRequestException(
        "Image alt text must contain 2-300 characters",
      );
    }
    validateVenueImage(file.mimetype, file.size);
    await this.venues.ownerDetail(owner.userId, id);
    const imageId = randomUUID();
    const objectKey = createVenueImageKey(id, file.mimetype);
    await this.storage.putObject(objectKey, file.buffer, file.mimetype);
    const url = `/api/v1/venues/${id}/images/${imageId}`;
    return this.venues.addImage(owner.userId, id, {
      id: imageId,
      objectKey,
      url,
      altText: altText.trim(),
    });
  }

  @Post("venues/:id/offerings")
  offering(
    @CurrentUser() owner: Principal,
    @Param("id") id: string,
    @Body() dto: CreateOfferingDto,
  ) {
    return this.venues.addOffering(owner.userId, id, dto);
  }

  @Patch("offerings/:id")
  updateOffering(
    @CurrentUser() owner: Principal,
    @Param("id") id: string,
    @Body() dto: UpdateOfferingDto,
  ) {
    return this.venues.updateOffering(owner.userId, id, dto);
  }

  @Post("offerings/:id/courts")
  court(
    @CurrentUser() owner: Principal,
    @Param("id") id: string,
    @Body() dto: CourtDto,
  ) {
    return this.venues.addCourt(owner.userId, id, dto.internalName);
  }

  @Patch("courts/:id")
  updateCourt(
    @CurrentUser() owner: Principal,
    @Param("id") id: string,
    @Body() dto: CourtDto,
  ) {
    return this.venues.updateCourt(owner.userId, id, dto.internalName);
  }

  @Patch("courts/:id/active")
  courtActive(
    @CurrentUser() owner: Principal,
    @Param("id") id: string,
    @Body() dto: CourtActiveDto,
  ) {
    return this.venues.setCourtActive(owner.userId, id, dto.isActive);
  }
}
