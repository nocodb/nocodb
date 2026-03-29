import { Injectable } from '@nestjs/common';
import type {
  DocumentCommentReqType,
  DocumentCommentUpdateReqType,
  UserType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class DocumentCommentsService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  async commentCreate(
    _context: NcContext,
    _param: {
      body: DocumentCommentReqType;
      user: UserType;
      req: NcRequest;
    },
  ) {
    return null;
  }

  async commentUpdate(
    _context: NcContext,
    _param: {
      commentId: string;
      body: DocumentCommentUpdateReqType;
      user: UserType;
      req: NcRequest;
    },
  ) {
    return null;
  }

  async commentDelete(
    _context: NcContext,
    _param: {
      commentId: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    return true;
  }

  async commentList(
    _context: NcContext,
    _param: {
      fk_doc_id: string;
      req: NcRequest;
    },
  ) {
    return [];
  }

  async toggleReaction(
    _context: NcContext,
    _param: {
      commentId: string;
      reaction: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    return null;
  }
}
