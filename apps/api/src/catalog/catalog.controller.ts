import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';

@Controller('clubs')
export class CatalogController {
  // @Inject явно: dev-раннер (tsx/esbuild) не эмитит design:paramtypes
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get()
  list() {
    return this.catalog.listClubs();
  }

  @Get(':slug')
  async bySlug(@Param('slug') slug: string) {
    const club = await this.catalog.getClubBySlug(slug);
    if (!club) throw new NotFoundException('Club not found');
    return club;
  }
}
