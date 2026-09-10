import { Controller, Get, Inject, Param, Query, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { VenuesService } from "./venues.service";
import { OBJECT_STORAGE, ObjectStorage } from "../storage/object-storage";
import { Response } from "express";
import { VenueSearchDto } from "./dto/venue.dto";

@ApiTags("public-catalog")
@Controller()
export class PublicVenuesController {
  constructor(
    private readonly venues: VenuesService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  @Get("venues")
  list(@Query() query: VenueSearchDto) {
    return this.venues.publicList(query.page, query.pageSize, query);
  }

  @Get("venues/:id")
  detail(@Param("id") id: string) {
    return this.venues.publicDetail(id);
  }

  @Get("venues/:venueId/images/:imageId")
  async image(
    @Param("venueId") venueId: string,
    @Param("imageId") imageId: string,
    @Res() response: Response,
  ) {
    const image = await this.venues.publicImage(venueId, imageId);
    const object = await this.storage.getObject(image.objectKey);
    response.type(object.contentType).send(object.data);
  }

  @Get("catalog")
  catalog() {
    return this.venues.referenceData();
  }

  @Get("sports")
  async sports() {
    return (await this.venues.referenceData()).sports;
  }

  @Get("areas")
  async areas() {
    return (await this.venues.referenceData()).areas;
  }

  @Get("amenities")
  async amenities() {
    return (await this.venues.referenceData()).amenities;
  }
}
