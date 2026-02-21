import { Injectable } from '@nestjs/common';
import { AppEvents, MapProvider, ViewTypes } from 'nocodb-sdk';
import axios from 'axios';
import type { MapUpdateReqType, UserType, ViewCreateReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { Response } from 'express';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { MapView, Model, User, View } from '~/models';
import { CacheScope } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';

@Injectable()
export class MapsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async mapViewGet(context: NcContext, param: { mapViewId: string }) {
    return await MapView.get(context, param.mapViewId);
  }

  async mapViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      map: ViewCreateReqType;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.map,
    );

    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    const model = await Model.get(context, param.tableId);

    const { id } = await View.insertMetaOnly(context, {
      view: {
        ...param.map,
        // todo: sanitize
        fk_model_id: param.tableId,
        type: ViewTypes.MAP,
        base_id: model.base_id,
        source_id: model.source_id,
        created_by: param.user?.id,
        owned_by: param.user?.id,
      },
      model,
      req: param.req,
    });

    // populate  cache and add to list since the list cache already exist
    const view = await View.get(context, id);
    await NocoCache.appendToList(
      context,
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );

    const owner = param.req.user;

    this.appHooksService.emit(AppEvents.MAP_CREATE, {
      view,
      req: param.req,
      owner,
      context,
    });

    return view;
  }

  async mapViewUpdate(
    context: NcContext,
    param: {
      mapViewId: string;
      map: MapUpdateReqType;
      req: NcRequest;
    },
  ) {
    validatePayload('swagger.json#/components/schemas/MapUpdateReq', param.map);

    const view = await View.get(context, param.mapViewId);

    if (!view) {
      NcError.get(context).viewNotFound(param.mapViewId);
    }

    const oldMapView = await MapView.get(context, param.mapViewId);

    await MapView.update(context, param.mapViewId, param.map);

    let owner = param.req.user;

    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by);
    }

    this.appHooksService.emit(AppEvents.MAP_UPDATE, {
      view: { ...view, ...param.map },
      mapView: param.map,
      oldMapView,
      oldView: view,
      req: param.req,
      context,
      owner,
    });

    await view.getView(context);

    return view;
  }

  async proxyMapTile(
    context: NcContext,
    {
      z,
      x,
      y,
      res,
    }: {
      z: string;
      x: string;
      y: string;
      tableId?: string;
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
    const mapProvider = process.env.NC_MAP_PROVIDER_NAME || 'openstreetmap';

    let tileUrl: string;

    switch (mapProvider) {
      case MapProvider.STADIAMAP_APIKEY: {
        const stadiaApiKey = process.env.NC_STADIA_MAPS_API_KEY;
        if (!stadiaApiKey) {
          NcError.get(context).internalServerError(
            `NC_STADIA_MAPS_API_KEY environment variable is required for NC_MAP_PROVIDER_NAME = ${MapProvider.STADIAMAP_APIKEY}`,
          );
        }
        tileUrl = `https://tiles.stadiamaps.com/tiles/osm_bright/${z}/${x}/${y}.png?api_key=${stadiaApiKey}`;
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
