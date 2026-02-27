import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { MapProvider } from 'nocodb-sdk';
import { MapsService as MapsServiceCE } from 'src/services/maps.service';
import type { Response } from 'express';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class MapsService extends MapsServiceCE {
  async proxyMapTile(
    context: NcContext,
    {
      z,
      x,
      y,
      theme,
      res,
    }: {
      z: string;
      x: string;
      y: string;
      theme?: string;
      res: Response;
    },
  ) {
    // Validate tile coordinates
    const zNum = parseInt(z);
    const xNum = parseInt(x);
    const yNum = parseInt(y);

    if (
      isNaN(zNum) ||
      isNaN(xNum) ||
      isNaN(yNum) ||
      zNum < 0 ||
      zNum > 19 ||
      xNum < 0 ||
      yNum < 0
    ) {
      NcError.get(context).badRequest('Invalid tile coordinates');
    }

    // TODO: Add caching layer here (Redis/memory) to reduce upstream requests
    // TODO: Add analytics/logging for tile requests (baseId, tableId, z/x/y)

    // Get map provider from environment
    const mapProvider = process.env.NC_MAP_TILE_PROVIDER || 'openstreetmap';

    let tileUrl: string;
    const allowedTheme = ['light', 'dark'];
    const useTheme = allowedTheme.includes(process.env.NC_MAP_TILE_THEME)
      ? process.env.NC_MAP_TILE_THEME
      : allowedTheme.includes(theme)
      ? theme
      : 'light';

    switch (mapProvider) {
      case MapProvider.STADIAMAP_APIKEY: {
        const stadiaApiKey = process.env.NC_MAP_TILE_KEY;
        if (!stadiaApiKey) {
          NcError.get(context).internalServerError(
            `NC_MAP_TILE_KEY environment variable is required`,
          );
        }
        const providerTheme =
          useTheme === 'light' ? 'osm_bright' : 'alidade_smooth_dark';
        tileUrl = `https://tiles.stadiamaps.com/tiles/${providerTheme}/${z}/${x}/${y}.png?api_key=${stadiaApiKey}`;
        break;
      }
      default:
        NcError.get(context).methodNotAllowed(
          `Map provider ${mapProvider} is not supported to run through proxy`,
        );
        break;
    }

    try {
      const response = await axios.get(tileUrl, {
        responseType: 'stream',
        timeout: 10000, // 10 second timeout
        validateStatus: (status) => status === 200, // Only accept 200, throw on any other status
      });

      // Set response headers for binary image
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day

      // Pipe the stream to the response
      response.data.pipe(res);

      // Handle stream errors
      response.data.on('error', (_err) => {
        // Can't send error response if headers already sent, just close
        if (!res.headersSent) {
          res.status(500).send('Stream error');
        }
      });
    } catch (error) {
      // Only throw if we haven't started sending the response
      if (!res.headersSent) {
        NcError.get(context).internalServerError(
          `Failed to fetch map tile: ${z}/${x}/${y}`,
        );
      }
    }
  }
}
